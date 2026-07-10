---
name: codex-rehome
description: Use when migrating, backing up, restoring, or reproducing a Codex Desktop workspace between Mac and Windows computers, including conversations, sessions, memories, skills, plugins, generated artifacts, project folders, path mappings, and restore verification.
---

# Codex Rehome

Project-local install of the workflow from https://github.com/CalebYcj/codex-rehome.

Use this workflow for Mac -> Windows, Windows -> Mac, same-OS moves, and same-computer reinstall backups.

## Mode

Default to `standard` unless the user explicitly asks for a fuller backup.

`standard` includes Codex sessions, selected SQLite state files, memories, goals, skills, plugin manifests/cache metadata, generated images, and selected project folders. It excludes auth tokens, browser login state, `.env`, private keys, sockets, `.git`, `node_modules`, virtual environments, build caches, and bulky generated installers.

## Mac -> Windows Source Packaging

1. Close Codex if possible for a cleaner snapshot.
2. Package neutral files under a schema-style folder:
   - `home/.codex`
   - selected Mac application-support inventory
   - `projects/`
   - `metadata/`
   - `Restore-Codex-To-Windows.ps1`
   - `README-RESTORE-WINDOWS.txt`
   - `MANIFEST.txt`
   - `SHA256SUMS.txt`
3. Include path mapping metadata from Mac paths to Windows restore paths.
4. Make the package private. It can contain conversation history and local project work.

## Windows Restore

On the Windows target:

1. Install and log in to Codex Desktop first.
2. Close Codex.
3. Unzip the migration package.
4. In PowerShell, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Restore-Codex-To-Windows.ps1 -RestoreProjects
```

The restore should merge files into `%USERPROFILE%\.codex`, preserve target login/config identity files, restore projects under `%USERPROFILE%\Documents\Codex-Restored-Projects`, and ask the user to reopen those project folders in Codex Desktop when automatic registration is unavailable.

## Report

When finishing a package, report:

- Package path and size.
- Migration mode.
- Source and target OS.
- Included project folders.
- Counts for sessions, archived sessions, skills, plugin manifests, generated images, SQLite files, and project files.
- Restore steps for Windows.
- Caveats: login state is not migrated, native dependencies must be reinstalled, old chat working-directory handles may not resume perfectly across OS paths.
