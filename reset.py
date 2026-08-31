from werkzeug.security import generate_password_hash

novo_hash = generate_password_hash(
    "Digitar senha",
    method="pbkdf2:sha256:260000"
)

print(novo_hash)