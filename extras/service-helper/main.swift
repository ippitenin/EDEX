// EDEX Service — a headless helper that publishes the "Open in EDEX" macOS service.
//
// Electron cannot register an NSServices provider on its own, so this tiny agent does it:
// macOS launches it when the menu entry is picked, hands it the selected folder, and it
// forwards the path to EDEX. Being a real service (as opposed to an Automator quick action)
// is what puts the entry in the main Finder context menu, next to Terminal's own.

import Cocoa

let edexBundleID = "com.edex.ui"

@discardableResult
func runningEDEX() -> NSRunningApplication? {
    NSRunningApplication.runningApplications(withBundleIdentifier: edexBundleID).first
}

func edexBundleURL() -> URL? {
    if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: edexBundleID) {
        return url
    }
    let fallback = URL(fileURLWithPath: "/Applications/EDEX.app")
    return FileManager.default.fileExists(atPath: fallback.path) ? fallback : nil
}

func open(directory path: String) {
    guard let bundleURL = edexBundleURL() else {
        NSLog("EDEX Service: EDEX.app not found")
        return
    }

    if let running = runningEDEX() {
        // Already up: re-exec the binary with the folder. Electron's single-instance lock
        // hands the argument to the live instance through second-instance, which opens it
        // in a free tab, and this short-lived process exits on its own.
        let binary = bundleURL.appendingPathComponent("Contents/MacOS/EDEX")
        let task = Process()
        task.executableURL = binary
        task.arguments = [path]
        try? task.run()
        running.activate()
    } else {
        let config = NSWorkspace.OpenConfiguration()
        config.arguments = [path]
        config.activates = true
        NSWorkspace.shared.openApplication(at: bundleURL, configuration: config)
    }
}

final class ServiceProvider: NSObject {
    @objc func openInEDEX(_ pasteboard: NSPasteboard,
                          userData: String?,
                          error: AutoreleasingUnsafeMutablePointer<NSString>?) {
        guard let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
              let first = urls.first else {
            error?.pointee = "No folder was passed to the service." as NSString
            quitSoon()
            return
        }

        // A file selection resolves to its enclosing folder.
        var isDirectory: ObjCBool = false
        var target = first
        if FileManager.default.fileExists(atPath: target.path, isDirectory: &isDirectory),
           !isDirectory.boolValue {
            target = target.deletingLastPathComponent()
        }

        open(directory: target.path)
        quitSoon()
    }

    private func quitSoon() {
        // Give the launch call a moment to reach the system before the agent exits.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { NSApp.terminate(nil) }
    }
}

let app = NSApplication.shared
let provider = ServiceProvider()
NSApp.servicesProvider = provider
NSUpdateDynamicServices()

// Nothing to do if no service request arrives — do not linger.
DispatchQueue.main.asyncAfter(deadline: .now() + 30) { NSApp.terminate(nil) }

app.setActivationPolicy(.accessory)
app.run()
