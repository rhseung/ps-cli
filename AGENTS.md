# PS CLI

## Commit messages

Commit messages should follow this format:

```txt
<type>: <title>
```

- Use the imperative mood for `<title>` (e.g. add, fix, update)

### `<type>` is one of the following

- `feat`: Introduces a new feature or capability
- `fix`: Fixes a bug or incorrect behavior
- `docs`: Documentation-only changes
- `style`: Code style or formatting changes with no behavior impact
- `refactor`: Code changes that improve structure without changing behavior
- `test`: Adds or updates tests
- `chore`: Maintenance tasks that don’t affect runtime behavior
- `ci`: Changes to CI/CD configuration

## Pull request titles

Pull request titles must follow the same convention as commit messages:

```txt
<type>: <title>
```

- Use a single primary type per PR
- Ensure the `<type>` and `<domain>` match the associated Linear issue
