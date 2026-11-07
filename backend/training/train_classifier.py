import os
import time
import json
import logging
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix, classification_report

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models

# Setup paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "dataset" / "processed"
TRAINED_MODELS_DIR = BASE_DIR / "trained_models"
TRAINED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_SAVE_PATH = TRAINED_MODELS_DIR / "best_mask_detector.pt"
METRICS_SAVE_PATH = TRAINED_MODELS_DIR / "evaluation_metrics.json"

CLASSES = ["Mask", "No Mask", "Incorrect Mask"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TrainClassifier")

def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")

def build_model(num_classes=3):
    """
    MobileNetV2 with custom classification head for real-time inference.
    """
    # Initialize MobileNetV2
    local_weights = Path.home() / ".cache/torch/hub/checkpoints/mobilenet_v2-7ebf99e0.pth"
    model = models.mobilenet_v2(weights=None)
    if local_weights.exists():
        try:
            state_dict = torch.load(str(local_weights), map_location="cpu")
            model.load_state_dict(state_dict)
            logger.info("Loaded pretrained MobileNetV2 ImageNet backbone weights from local cache.")
        except Exception as e:
            logger.warning(f"Could not load local weights: {e}")
    else:
        logger.info("Using standard initialized MobileNetV2 backbone.")

    # Freeze early feature layers to preserve low-level edge/texture detectors
    for param in list(model.features.parameters())[:-8]:
        param.requires_grad = False

    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, 128),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(128, num_classes)
    )
    return model

def get_dataloaders(batch_size=32, img_size=224):
    train_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    eval_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_dir = DATASET_DIR / "train"
    val_dir = DATASET_DIR / "val"
    test_dir = DATASET_DIR / "test"

    train_dataset = datasets.ImageFolder(str(train_dir), transform=train_transform)
    val_dataset = datasets.ImageFolder(str(val_dir), transform=eval_transform)
    test_dataset = datasets.ImageFolder(str(test_dir), transform=eval_transform)

    logger.info(f"Class to idx mapping: {train_dataset.class_to_idx}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=False)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=False)

    return train_loader, val_loader, test_loader, train_dataset.classes

def train_and_evaluate(epochs=10, batch_size=32, lr=0.0003, patience=4):
    device = get_device()
    logger.info(f"Training on device: {device}")

    train_loader, val_loader, test_loader, class_names = get_dataloaders(batch_size=batch_size)

    model = build_model(num_classes=len(class_names)).to(device)

    # Class weights for loss
    weights_path = TRAINED_MODELS_DIR / "class_weights.json"
    weights_tensor = None
    if weights_path.exists():
        with open(weights_path) as f:
            w_dict = json.load(f)
            w_list = [w_dict.get(c, 1.0) for c in class_names]
            weights_tensor = torch.tensor(w_list, dtype=torch.float32).to(device)
            logger.info(f"Using class weights: {w_list}")

    criterion = nn.CrossEntropyLoss(weight=weights_tensor)
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    history = {
        "train_loss": [], "val_loss": [],
        "train_acc": [], "val_acc": []
    }

    best_val_loss = float("inf")
    patience_counter = 0

    print("=" * 60)
    print(f"Starting MobileNetV2 Transfer Learning for {epochs} Epochs...")
    print("=" * 60)

    start_train_time = time.time()

    for epoch in range(1, epochs + 1):
        # 1. Training Phase
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct_train += torch.sum(preds == labels.data).item()
            total_train += labels.size(0)

        scheduler.step()

        epoch_train_loss = running_loss / total_train
        epoch_train_acc = correct_train / total_train

        # 2. Validation Phase
        model.eval()
        running_val_loss = 0.0
        correct_val = 0
        total_val = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device)
                labels = labels.to(device)

                outputs = model(images)
                loss = criterion(outputs, labels)

                running_val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                correct_val += torch.sum(preds == labels.data).item()
                total_val += labels.size(0)

        epoch_val_loss = running_val_loss / total_val
        epoch_val_acc = correct_val / total_val

        history["train_loss"].append(epoch_train_loss)
        history["val_loss"].append(epoch_val_loss)
        history["train_acc"].append(epoch_train_acc)
        history["val_acc"].append(epoch_val_acc)

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {epoch_train_loss:.4f} | Train Acc: {epoch_train_acc*100:.2f}% | "
            f"Val Loss: {epoch_val_loss:.4f} | Val Acc: {epoch_val_acc*100:.2f}%"
        )

        # Model Checkpointing & Early Stopping
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            torch.save(model.state_dict(), str(MODEL_SAVE_PATH))
            print(f"  --> Saved new best checkpoint to {MODEL_SAVE_PATH} (Val Loss: {best_val_loss:.4f})")
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping triggered at epoch {epoch}.")
                break

    train_duration = time.time() - start_train_time
    print(f"\nTraining completed in {train_duration:.2f} seconds.")

    # 3. Plot Training Curves
    plot_training_curves(history)

    # 4. Evaluate Unseen Test Set
    print("\n" + "=" * 60)
    print("Evaluating Model on Unseen Test Set...")
    print("=" * 60)
    # Load best checkpoint
    model.load_state_dict(torch.load(str(MODEL_SAVE_PATH), map_location=device))
    metrics = evaluate_test_set(model, test_loader, class_names, device)

    return metrics

def plot_training_curves(history):
    epochs_range = range(1, len(history["train_loss"]) + 1)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Loss curve
    ax1.plot(epochs_range, history["train_loss"], 'b-o', label='Training Loss', linewidth=2)
    ax1.plot(epochs_range, history["val_loss"], 'r--s', label='Validation Loss', linewidth=2)
    ax1.set_title('Training & Validation Loss', fontsize=13, fontweight='bold')
    ax1.set_xlabel('Epochs', fontsize=11)
    ax1.set_ylabel('Cross-Entropy Loss', fontsize=11)
    ax1.legend(fontsize=11)
    ax1.grid(True, linestyle='--', alpha=0.6)

    # Accuracy curve
    ax2.plot(epochs_range, [acc * 100 for acc in history["train_acc"]], 'b-o', label='Training Accuracy', linewidth=2)
    ax2.plot(epochs_range, [acc * 100 for acc in history["val_acc"]], 'g--s', label='Validation Accuracy', linewidth=2)
    ax2.set_title('Training & Validation Accuracy', fontsize=13, fontweight='bold')
    ax2.set_xlabel('Epochs', fontsize=11)
    ax2.set_ylabel('Accuracy (%)', fontsize=11)
    ax2.legend(fontsize=11)
    ax2.grid(True, linestyle='--', alpha=0.6)

    plt.tight_layout()
    chart_path = TRAINED_MODELS_DIR / "training_history.png"
    plt.savefig(chart_path, dpi=200)
    plt.close()
    print(f"Saved training curves to {chart_path}")

def evaluate_test_set(model, test_loader, class_names, device):
    model.eval()
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)

            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(labels.numpy())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    # Compute Metrics
    acc = accuracy_score(all_targets, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average='weighted', zero_division=0)
    cm = confusion_matrix(all_targets, all_preds)

    print(f"Test Accuracy:  {acc * 100:.2f}%")
    print(f"Test Precision: {precision * 100:.2f}%")
    print(f"Test Recall:    {recall * 100:.2f}%")
    print(f"Test F1-Score:  {f1 * 100:.2f}%\n")

    print("Detailed Classification Report:")
    report = classification_report(all_targets, all_preds, target_names=class_names, digits=4)
    print(report)

    # Plot Confusion Matrix
    plt.figure(figsize=(7, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=class_names, yticklabels=class_names,
                cbar=False, annot_kws={"size": 14, "weight": "bold"})
    plt.title('Confusion Matrix on Unseen Test Data', fontsize=13, fontweight='bold')
    plt.xlabel('Predicted Label', fontsize=11, fontweight='bold')
    plt.ylabel('True Label', fontsize=11, fontweight='bold')
    plt.tight_layout()

    cm_path = TRAINED_MODELS_DIR / "confusion_matrix.png"
    plt.savefig(cm_path, dpi=200)
    plt.close()
    print(f"Saved confusion matrix heatmap to {cm_path}")

    # Save to JSON
    results = {
        "accuracy": round(float(acc), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1_score": round(float(f1), 4),
        "classes": class_names,
        "confusion_matrix": cm.tolist(),
        "total_test_samples": int(len(all_targets))
    }

    with open(METRICS_SAVE_PATH, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Saved test evaluation metrics to {METRICS_SAVE_PATH}")

    return results

if __name__ == "__main__":
    train_and_evaluate(epochs=8, batch_size=32, lr=0.0003)
