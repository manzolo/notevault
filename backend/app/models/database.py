from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey,
    UniqueConstraint, Index, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import TSVECTOR, BYTEA
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base
from app.models.enums import SecretType, AuditAction


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    totp_secret = Column(BYTEA, nullable=True)  # encrypted nonce||ciphertext
    totp_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="owner", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("name", "user_id", name="uq_category_name_user"),)

    owner = relationship("User", back_populates="categories")
    notes = relationship("Note", back_populates="category")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False, default="")
    is_pinned = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    fts_vector = Column(TSVECTOR)  # populated by DB trigger only
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="notes")
    category = relationship("Category", back_populates="notes")
    tags = relationship("Tag", secondary="note_tags", back_populates="notes")
    secrets = relationship("Secret", back_populates="note", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="note", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="note", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("name", "user_id", name="uq_tag_name_user"),)

    notes = relationship("Note", secondary="note_tags", back_populates="tags")
    attachments = relationship("Attachment", secondary="attachment_tags", back_populates="tags")
    bookmarks = relationship("Bookmark", secondary="bookmark_tags", back_populates="tags")


class NoteTag(Base):
    __tablename__ = "note_tags"

    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Secret(Base):
    __tablename__ = "secrets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    secret_type = Column(
        SAEnum(SecretType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SecretType.OTHER,
    )
    username = Column(String(255), nullable=True)
    url = Column(String(2048), nullable=True)
    public_key = Column(Text, nullable=True)  # SSH public key, stored plain (not a secret)
    encrypted_value = Column(BYTEA, nullable=False)  # nonce(12B) || ciphertext
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="secrets")
    access_logs = relationship("SecretAccessLog", back_populates="secret", cascade="all, delete-orphan")


class SecretAccessLog(Base):
    __tablename__ = "secret_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    secret_id = Column(Integer, ForeignKey("secrets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(
        SAEnum(AuditAction, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    secret = relationship("Secret", back_populates="access_logs")
    user = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    extracted_text = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    file_modified_at = Column(DateTime(timezone=True), nullable=True)
    fts_vector = Column(TSVECTOR)  # populated by DB trigger only
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="attachments")
    tags = relationship("Tag", secondary="attachment_tags", back_populates="attachments")


class AttachmentTag(Base):
    __tablename__ = "attachment_tags"

    attachment_id = Column(Integer, ForeignKey("attachments.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(Text, nullable=False)
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    fts_vector = Column(TSVECTOR)  # populated by DB trigger only
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="bookmarks")
    tags = relationship("Tag", secondary="bookmark_tags", back_populates="bookmarks")


class BookmarkTag(Base):
    __tablename__ = "bookmark_tags"

    bookmark_id = Column(Integer, ForeignKey("bookmarks.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
