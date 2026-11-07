import pytest
from app.database.init_db import init_database

@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    """
    Ensure all tables and default seed records are created before tests execute.
    """
    init_database()
