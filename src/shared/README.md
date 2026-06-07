# Shared

Shared code should stay small. Put a value here only when multiple modules need it and no single module clearly owns it.

## Folders

- `constants`: shared enum-like values and stable labels
- `types`: cross-module type contracts
- `utils`: generic helpers without domain ownership

Avoid turning `shared` into a catch-all. Domain rules belong in domain modules.

