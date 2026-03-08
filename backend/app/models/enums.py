import enum


class SecretType(str, enum.Enum):
    PASSWORD = "password"
    API_KEY = "api_key"
    TOKEN = "token"
    SSH_KEY = "ssh_key"
    CERTIFICATE = "certificate"
    OTHER = "other"


class AuditAction(str, enum.Enum):
    NOTE_CREATE = "note_create"
    NOTE_UPDATE = "note_update"
    NOTE_DELETE = "note_delete"
    SECRET_CREATE = "secret_create"
    SECRET_REVEAL = "secret_reveal"
    SECRET_DELETE = "secret_delete"
    LOGIN = "login"
    REGISTER = "register"
