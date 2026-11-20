"""Initial schema baseline with 18 tables

Revision ID: 0001_initial
Revises: 
Create Date: 2026-11-10 11:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Schema creation is handled by Base.metadata.create_all(engine)
    # This migration baseline marks the schema state for production migrations
    pass

def downgrade() -> None:
    pass
