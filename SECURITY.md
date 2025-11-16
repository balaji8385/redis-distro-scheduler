# Security Policy

## Supported Versions

Only the following versions receive security updates:

| Version | Supported |
|-------- |-----------|
| ≥ 1.x   | ✅ Yes     |
| 0.x     | ⚠️ Limited |

## Reporting a Vulnerability

If you discover a security issue, please email the maintainer:

📧 **lbalaji8385@gmail.com**

**Do not open public GitHub issues** for security vulnerabilities.

Please include:

- Steps to reproduce
- Impact (data loss, execution, unauthorized job execution, etc.)
- Suggested fix if possible

You will receive:

- Acknowledgement within **48 hours**
- Follow-up within **5 days**
- Credit in the release notes (optional)

## Scope

This project handles distributed scheduling and tenant isolation.  
Report issues related to:

- Lock bypass
- Jitter/cron injection
- Race conditions causing duplicate execution
- Redis security misconfiguration

