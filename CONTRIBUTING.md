# Contributing to redis-distro-scheduler

Thank you for your interest in contributing!  
We welcome bug fixes, improvements, documentation updates, and feature proposals.

## 📦 Getting Started

1. Fork the repository  
2. Clone your fork  
3. Install dependencies:

```bash
npm install
````

4. Build the project:

```bash
npm run build
```

5. Run tests:

```bash
npm test
```

## 🧭 Branching Model

* `main` — stable, production-ready.
* `dev` — active development.
* Feature branches must follow:

```
feature/<short-description>
fix/<short-description>
chore/<short-description>
docs/<short-description>
```

## 🧪 Testing

We use **Vitest** for all tests:

```bash
npm test
```

Please ensure all tests pass before submitting PRs.

## 📝 Pull Requests

* Follow existing code style
* Include tests for any new functionality
* Update relevant documentation
* Keep PRs small and focused
* Add clear commit messages

## 🔍 Code Style

* TypeScript strict mode is enabled
* Use ES2022 features
* No unused types or variables
* Prefer explicit types

## ❗ Reporting Issues

For bugs or feature requests, open an issue and include:

* What happened?
* Expected behavior
* Steps to reproduce
* Environment (Node version, OS)
* Logs if applicable

## ❤️ Thanks

Your contributions help make this library better for everyone!