import os
import zipfile
import shutil
import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "dataset"
RAW_DIR = DATASET_DIR / "raw"
PROCESSED_DIR = DATASET_DIR / "processed"
TRAINED_MODELS_DIR = BASE_DIR / "trained_models"

TRAINED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

CLASS_MAP = {
    "mask_weared_incorrect": "Incorrect Mask",
    "without_mask": "No Mask",
    "with_mask": "Mask"
}

STANDARD_CLASSES = ["Mask", "No Mask", "Incorrect Mask"]

def organize_and_standardize():
    """
    Scans raw directory and arranges images into:
    processed/
      train/
        Mask/
        No Mask/
        Incorrect Mask/
      val/
        ...
      test/
        ...
    """
    # Clean previous processed
    if PROCESSED_DIR.exists():
        shutil.rmtree(PROCESSED_DIR)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    for split in ["train", "val", "test"]:
        raw_split_dir = RAW_DIR / split
        target_split_dir = PROCESSED_DIR / split

        for std_cls in STANDARD_CLASSES:
            (target_split_dir / std_cls).mkdir(parents=True, exist_ok=True)

        if not raw_split_dir.exists():
            continue

        for root, dirs, files in os.walk(raw_split_dir):
            parent_folder = Path(root).name.lower()
            if parent_folder in CLASS_MAP:
                target_cls = CLASS_MAP[parent_folder]
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                        src = Path(root) / file
                        dst = target_split_dir / target_cls / file
                        shutil.copy2(src, dst)

    print("Organized datasets into standard classes successfully.")

def analyze_and_visualize():
    counts = {"train": {}, "val": {}, "test": {}}

    for split in counts.keys():
        for std_cls in STANDARD_CLASSES:
            cls_dir = PROCESSED_DIR / split / std_cls
            num_files = len(list(cls_dir.glob("*.*"))) if cls_dir.exists() else 0
            counts[split][std_cls] = num_files

    print("\nDataset Class Counts:")
    for split, data in counts.items():
        total = sum(data.values())
        print(f"  {split.upper()} (Total: {total}):")
        for cls_name, count in data.items():
            pct = (count / total * 100) if total > 0 else 0
            print(f"    - {cls_name}: {count} ({pct:.1f}%)")

    # Generate Class Distribution Plot
    fig, ax = plt.subplots(figsize=(10, 6))
    x = np.arange(len(STANDARD_CLASSES))
    width = 0.25

    colors = ["#3B82F6", "#10B981", "#F59E0B"]

    rects1 = ax.bar(x - width, [counts["train"][c] for c in STANDARD_CLASSES], width, label='Train', color=colors[0])
    rects2 = ax.bar(x, [counts["val"][c] for c in STANDARD_CLASSES], width, label='Validation', color=colors[1])
    rects3 = ax.bar(x + width, [counts["test"][c] for c in STANDARD_CLASSES], width, label='Test', color=colors[2])

    ax.set_ylabel('Number of Images', fontsize=12, fontweight='bold')
    ax.set_title('Face Mask Compliance Dataset - Class Distribution Across Splits', fontsize=14, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(STANDARD_CLASSES, fontsize=11, fontweight='bold')
    ax.legend(fontsize=11)
    ax.grid(axis='y', linestyle='--', alpha=0.7)

    # Attach count labels above bars
    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            if height > 0:
                ax.annotate(f'{height}',
                            xy=(rect.get_x() + rect.get_width() / 2, height),
                            xytext=(0, 3),
                            textcoords="offset points",
                            ha='center', va='bottom', fontsize=9, fontweight='bold')

    autolabel(rects1)
    autolabel(rects2)
    autolabel(rects3)

    plt.tight_layout()
    chart_path = TRAINED_MODELS_DIR / "class_distribution.png"
    plt.savefig(chart_path, dpi=200)
    plt.close()
    print(f"\nSaved class distribution chart to {chart_path}")

    # Compute Class Weights to Handle Class Imbalance
    train_counts = counts["train"]
    total_train = sum(train_counts.values())
    class_weights = {}
    if total_train > 0:
        n_classes = len(STANDARD_CLASSES)
        for c in STANDARD_CLASSES:
            cnt = max(train_counts[c], 1)
            # balanced weight = N / (n_classes * count_c)
            class_weights[c] = round(total_train / (n_classes * cnt), 4)

    weights_path = TRAINED_MODELS_DIR / "class_weights.json"
    with open(weights_path, "w") as f:
        json.dump(class_weights, f, indent=2)
    print(f"Saved class weights to {weights_path}: {class_weights}")

    return counts, class_weights

if __name__ == "__main__":
    organize_and_standardize()
    analyze_and_visualize()
