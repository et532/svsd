# rel-a report

Files: Backup.swift (BackupReminder), SettingsView.swift (onDismiss cleanup, recordBackup), Shell.swift (launch hook), BackupReminderTests.swift.
Tests: 152 run, 1 skipped, 0 failures (3 new).
Note: lastBackupAt is recorded when the export is made (sheet opens), not on confirmed share. A release install that taps "Try with sample people" after first launch (baseline 0) would get a reminder (500 growth); fixing needs Seed.swift or ConnectionsView.
