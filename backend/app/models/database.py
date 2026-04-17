from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey,
    UniqueConstraint, Index, Enum as SAEnum, JSON
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
    calendar_token = Column(String(64), nullable=True, unique=True, index=True)
    telegram_chat_id = Column(String(100), nullable=True)
    notification_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="owner", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="user", cascade="all, delete-orphan")
    event_attachments = relationship("EventAttachment", back_populates="user", cascade="all, delete-orphan")
    event_reminders = relationship("EventReminder", back_populates="user", cascade="all, delete-orphan")
    task_reminders = relationship("TaskReminder", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("name", "user_id", "parent_id", name="uq_category_name_user_parent"),)

    owner = relationship("User", back_populates="categories")
    notes = relationship("Note", back_populates="category")
    children = relationship(
        "Category",
        primaryjoin="Category.parent_id == Category.id",
        foreign_keys="[Category.parent_id]",
        lazy="noload",
    )


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False, default="")
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
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
    tasks = relationship("Task", back_populates="note", cascade="all, delete-orphan")
    share_tokens = relationship("ShareToken", back_populates="note", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="note", cascade="all, delete-orphan")
    fields = relationship("NoteField", back_populates="note", cascade="all, delete-orphan", order_by="NoteField.position")


class NoteField(Base):
    __tablename__ = "note_fields"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    group_name = Column(String(200), nullable=False, default='')
    key = Column(String(500), nullable=False)
    value = Column(Text, nullable=False, default='')
    position = Column(Integer, nullable=False, default=0)
    link = Column(Text, nullable=True)
    field_note = Column(Text, nullable=True)
    field_date = Column(Date, nullable=True)
    price = Column(Text, nullable=True)
    field_image = Column(Text, nullable=True)
    fts_vector = Column(TSVECTOR)  # populated by DB trigger only
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="fields")


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
    position = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    archive_note = Column(Text, nullable=True)
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
    position = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    archive_note = Column(Text, nullable=True)
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
    position = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    archive_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="bookmarks")
    tags = relationship("Tag", secondary="bookmark_tags", back_populates="bookmarks")


class BookmarkTag(Base):
    __tablename__ = "bookmark_tags"

    bookmark_id = Column(Integer, ForeignKey("bookmarks.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    is_done = Column(Boolean, default=False, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    position = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    archive_note = Column(Text, nullable=True)
    fts_vector = Column(TSVECTOR)  # populated by DB trigger only
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="tasks")
    user = relationship("User", back_populates="tasks")
    reminders = relationship("TaskReminder", back_populates="task", cascade="all, delete-orphan")


class TaskReminder(Base):
    __tablename__ = "task_reminders"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    minutes_before = Column(Integer, nullable=False)
    notify_in_app = Column(Boolean, default=True, nullable=False)
    notify_telegram = Column(Boolean, default=False, nullable=False)
    notify_email = Column(Boolean, default=False, nullable=False)
    notified_at = Column(DateTime(timezone=True), nullable=True)  # set when fired; single-occurrence
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="reminders")
    user = relationship("User", back_populates="task_reminders")


class ShareToken(Base):
    __tablename__ = "share_tokens"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), nullable=False, unique=True, index=True)
    share_sections = Column(
        JSON,
        nullable=False,
        server_default='{"content":true,"tasks":false,"attachments":false,"bookmarks":false,"secrets":false,"events":false}',
    )
    visibility = Column(String(20), nullable=False, default="public", server_default="public")
    allowed_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    note = relationship("Note", back_populates="share_tokens")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=True)
    url = Column(String(2048), nullable=True)
    recurrence_rule = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    archive_note = Column(Text, nullable=True)
    fts_vector = Column(TSVECTOR)  # populated by DB trigger only
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note = relationship("Note", back_populates="events")
    user = relationship("User", back_populates="events")
    attachments = relationship("EventAttachment", back_populates="event", cascade="all, delete-orphan")
    reminders = relationship("EventReminder", back_populates="event", cascade="all, delete-orphan")


class EventAttachment(Base):
    __tablename__ = "event_attachments"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="attachments")
    user = relationship("User", back_populates="event_attachments")


class EventReminder(Base):
    __tablename__ = "event_reminders"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    minutes_before = Column(Integer, nullable=False)
    notify_in_app = Column(Boolean, default=True, nullable=False)
    notify_telegram = Column(Boolean, default=False, nullable=False)
    notify_email = Column(Boolean, default=False, nullable=False)
    last_notified_occurrence = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="reminders")
    user = relationship("User", back_populates="event_reminders")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    snoozed_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
    event = relationship("Event")
    task = relationship("Task")
