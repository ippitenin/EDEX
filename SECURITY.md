# Security Policy

This is the policy of **EDEX**, a fork of eDEX-UI maintained at
[ippitenin/EDEX](https://github.com/ippitenin/EDEX). The upstream project is archived; please do
not report problems with this fork to its author.

## Supported versions

The latest release and the `master` branch. Older builds are not patched — rebuild from `master`.

## Reporting a vulnerability

Open an [issue](https://github.com/ippitenin/EDEX/issues/new) that says you have a security
report, **without the details**, and a private channel will be arranged for them. Once there,
describe what is affected and how to reproduce it; a crafted file name, theme or layout that
demonstrates the issue is ideal.

Keep in mind what the app is: the renderer runs with Node integration and without context
isolation (see the known limitation in [README.md](README.md)), so markup injected anywhere in the
interface is code execution. Reports of exactly that are the most valuable kind. What has already
been found and fixed, and what is known and still open, is in [AUDIT.md](AUDIT.md).
