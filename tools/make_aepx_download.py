"""Builds site/aepx-ide-download.html for softwareequality.com.

Layout follows business-ai-manager-download.html (one card per platform). The head,
site menu and footer come from aepx-ide.html so the page matches the product page.
Installers are served from https://ide.softwareequality.com/downloads/ (mirrored from the
newest ide-v* release). The site's security policy only allows cross-site images, so a
small script probes downloads/status/<tag>/<file>.gif (same release only) and only enables a button whose file
exists; everything else reads "Available soon".
"""
import html
import pathlib
import re
import sys

SITE = pathlib.Path(sys.argv[1])
# Release whose files the buttons fall back to, and the files it contains (one per line).
TAG = sys.argv[2]
RELEASED = set(pathlib.Path(sys.argv[3]).read_text().split())
GH = f"https://github.com/aliabdalla-maker/aepx-core/releases/download/{TAG}/"
DL = "https://ide.softwareequality.com/downloads/"
WEB = "https://ide.softwareequality.com/"
CARD = "background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:16px;padding:1.5rem;"
H2 = "margin-top:0;font-size:1.3rem;line-height:1.3;"
P = "color:var(--text-muted);"
PRIMARY = "display:inline-block;margin-top:.75rem;margin-inline-end:.5rem;padding:.7rem 1.2rem;border-radius:10px;background:#1d4ed8;color:#fff;font-weight:600;text-decoration:none;"
SECOND = "display:inline-block;margin-top:.75rem;margin-inline-end:.5rem;padding:.6rem 1.1rem;border-radius:10px;border:1px solid var(--border,#cbd5e1);font-weight:600;text-decoration:none;"
OL = "margin:.9rem 0 0;padding-inline-start:1.2rem;color:var(--text-muted);font-size:.95rem;"
NOTE = "color:var(--text-muted);font-size:.9rem;margin:.8rem 0 0;"


def file_btn(name, label, primary=False):
    style = PRIMARY if primary else SECOND
    if name not in RELEASED:  # not in this release yet: shown, but not clickable
        return (f'<a style="{style}opacity:.55;cursor:default;" aria-disabled="true" data-file="{name}">'
                f'{html.escape(label)} (available soon)</a>')
    # Direct one-click download from the published release; switched to our own server's
    # mirror by the script below once ide.softwareequality.com/downloads is live.
    return (f'<a style="{style}" href="{GH}{name}" data-file="{name}" data-released download>'
            f'{html.escape(label)}</a>')


def web_btn(label, primary=True):
    return f'<a style="{PRIMARY if primary else SECOND}" href="{WEB}" data-web>{html.escape(label)}</a>'


def card(cid, title, text, buttons, steps=(), note=""):
    out = [f'  <div id="{cid}" style="{CARD}"><h2 style="{H2}">{title}</h2><p style="{P}">{text}</p>',
           "    " + "".join(buttons)]
    if steps:
        out.append(f'    <ol style="{OL}">' + "".join(f"<li>{s}</li>" for s in steps) + "</ol>")
    if note:
        out.append(f'    <p style="{NOTE}">{note}</p>')
    out[-1] += "</div>"
    return "\n".join(out)


cards = [
    card("dl-windows", "Windows PC",
         "The desktop app for Windows 10 and 11 (Intel, AMD and Arm). It opens in its own window and appears in the Start menu and taskbar.",
         [file_btn("AEP-X-IDE-Windows-Setup.exe", "Download for Windows (.exe)", True),
          file_btn("AEP-X-IDE-Windows-Portable.exe", "Portable version (no install)"),
          web_btn("Install from your browser", False)],
         note='If Windows shows "Windows protected your PC", choose More info, then Run anyway. The installer is from Equality Software Ltd.'),
    card("dl-mac", "Mac",
         "For macOS 12 or later. Choose Apple silicon for M1, M2, M3 and M4 Macs, or Intel for older Macs (Apple menu, About This Mac shows which).",
         [file_btn("AEP-X-IDE-macOS-AppleSilicon.dmg", "Download for Apple silicon", True),
          file_btn("AEP-X-IDE-macOS-Intel.dmg", "Download for Intel Macs")],
         ["Open the downloaded file and drag AEP-X IDE into Applications.",
          "The first time you open it, if macOS says it cannot check the developer, open System Settings, Privacy &amp; Security, and choose Open Anyway.",
          "Sign in or create your account."]),
    card("dl-linux", "Linux",
         "For Ubuntu, Debian, Fedora, Red Hat, openSUSE, Arch and other distributions, on x86-64 or Arm64 (for example Raspberry Pi 4 and 5).",
         [file_btn("AEP-X-IDE-Linux-x86_64.AppImage", "AppImage (x86-64)", True),
          file_btn("AEP-X-IDE-Linux-arm64.AppImage", "AppImage (Arm64)"),
          file_btn("AEP-X-IDE-Linux-amd64.deb", "Ubuntu / Debian (.deb)"),
          file_btn("AEP-X-IDE-Linux-arm64.deb", "Ubuntu / Debian Arm64 (.deb)"),
          file_btn("AEP-X-IDE-Linux-x86_64.rpm", "Fedora / Red Hat / openSUSE (.rpm)"),
          file_btn("AEP-X-IDE-Linux-x64.tar.gz", "Any distribution (.tar.gz)"),
          file_btn("AEP-X-IDE-Linux-arm64.tar.gz", "Any distribution Arm64 (.tar.gz)")],
         ["AppImage: make it executable (right-click, Properties, Allow executing, or <code>chmod +x</code>), then double-click it.",
          ".deb: <code>sudo apt install ./AEP-X-IDE-Linux-amd64.deb</code>. .rpm: <code>sudo dnf install ./AEP-X-IDE-Linux-x86_64.rpm</code>.",
          ".tar.gz: unpack it and run <code>aepx-ide</code> from the folder."]),
    card("dl-unix", "Unix (FreeBSD, OpenBSD, NetBSD, illumos, Solaris, AIX)",
         "There is no native desktop build for these systems, because the desktop framework the app uses does not support them. Use the full IDE in Firefox or Chromium instead; nothing is lost.",
         [web_btn("Open the web app"),
          file_btn("AEP-X-IDE-Linux-x64.tar.gz", "Linux .tar.gz for FreeBSD's Linux layer")],
         ["In Firefox or Chromium, open the web app and sign in.",
          "In Chromium, choose Install from the address bar to give it its own window."],
         note="On FreeBSD, the Linux build may also run under the Linux compatibility layer (linux64). That route is not officially supported."),
    card("dl-play", "Android: Google Play",
         "For phones and tablets, with automatic updates and payment through Google Play.",
         ['<span style="' + SECOND + 'opacity:.6;cursor:default;" aria-disabled="true">Coming soon to Google Play</span>'],
         note="Until then, use the APK below. Your account and plan carry over when the Play version arrives."),
    card("dl-apk", "Android: direct download (APK)",
         "For Android 8 or later, with or without Google Play. Pay by card on the web.",
         [file_btn("AEP-X-IDE-Android.apk", "Download APK", True)],
         ["Open the downloaded file.", "If asked, allow your browser to install unknown apps.",
          "Tap Install, then sign in with your account."]),
    card("dl-ios", "iPhone and iPad",
         "Install from Safari in seconds, with no App Store needed. It opens full screen from your Home Screen like any app.",
         [web_btn("Install on iPhone or iPad")],
         ["Open this page on your iPhone or iPad in Safari and tap the button.", "Tap Share, then Add to Home Screen.",
          "Open AEP-X IDE from your Home Screen and sign in."],
         note="An App Store version is coming. Your account and projects stay the same."),
    card("dl-plugins", "Editor plugins: VS Code and JetBrains",
         "Use the AEP-X agents inside the editor you already use: VS Code, IntelliJ IDEA, PyCharm, WebStorm and the other JetBrains IDEs.",
         [file_btn("AEP-X-IDE-VSCode.vsix", "VS Code extension (.vsix)", True),
          file_btn("AEP-X-IDE-JetBrains.zip", "JetBrains plugin (.zip)")],
         ["VS Code: Extensions, the ... menu, Install from VSIX, then choose the file.",
          "JetBrains: Settings, Plugins, the gear icon, Install Plugin from Disk, then choose the file.",
          "Sign in with your AEP-X account when asked."],
         note="Use AEP-X: New project to start in any of the nine IDEs from your editor."),
    card("dl-claude", "Claude Code plugin",
         "Create AEP-X projects and run approval-gated agent crews from Claude Code, with the aepx-ide plugin from the AEP-X marketplace.",
         [],
         ["In Claude Code run <code>/plugin marketplace add aliabdalla-maker/aepx-core</code>.",
          "Then <code>/plugin install aepx-ide@aepx</code>.",
          "Use <code>/aepx-new-project</code> or <code>/aepx-agent-run</code>."]),
    card("dl-sdk", "Agentic SDK (Python)",
         "Build your own governed agents and automations on AEP-X: plans, approvals and the audit trail from your own code. Python 3.10 or later.",
         [file_btn("AEP-X-Agentic-SDK-Python.zip", "Download the SDK (.zip)", True)],
         ["Install it with <code>pip install AEP-X-Agentic-SDK-Python.zip</code>.",
          "Then <code>import aepx</code> in your code."]),
    card("dl-web", "Web app (any computer)",
         "Nothing to install. Works in Chrome, Edge, Safari and Firefox on Windows, Mac, Linux, Unix and Chromebooks. In Chrome or Edge choose Install to add it to your desktop.",
         [web_btn("Open the web app")]),
]

main = f'''<main id="main">
<section style="padding:3rem 0 1rem;"><div class="container" style="max-width:1000px;margin:0 auto;padding:0 1.25rem;">
  <nav aria-label="Breadcrumb" style="font-size:.9rem;color:var(--text-muted);"><a href="/">Home</a> / <a href="/aepx-ide">AEP-X Agentic IDE</a> / Download</nav>
  <div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap;margin-top:1rem;">
    <img src="/aepx-ide-icon.png" alt="AEP-X Agentic IDE app icon" width="88" height="88" style="border-radius:20px;box-shadow:0 4px 16px rgba(15,23,42,.12);">
    <div><h1 style="margin:0;font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.15;">Download AEP-X Agentic IDE</h1>
    <p style="color:var(--text-muted);margin:.4rem 0 0;">Agents plan your software, music, video, film, multimedia and social media work and its deployment, you approve every step, and each action is audited. Includes Media Studio, editor plugins and the Agentic SDK. One account works on every device.</p></div>
  </div>
  <p style="margin-top:1.25rem;padding:1rem 1.25rem;border-radius:12px;background:#eef2ff;color:#1e1b4b;">Free for 30 days, with ads. Then £4.99/month with 95% fewer ads, or keep using the free plan with ads. Cancel any time. One subscription covers Windows, Mac, Linux, Android, iPhone and the web.</p>
  <p id="dl-status" style="margin:.6rem 0 0;color:var(--text-muted);" role="status" aria-live="polite"></p>
</div></section>
<section style="padding:1rem 0 3rem;"><div class="container" style="max-width:1000px;margin:0 auto;padding:0 1.25rem;display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">
{chr(10).join(cards)}
</div>
<div class="container" style="max-width:1000px;margin:1.5rem auto 0;padding:0 1.25rem;color:var(--text-muted);font-size:.9rem;">
  <p><a href="/aepx-ide-privacy">By downloading you agree to our privacy policy.</a> Version {TAG.removeprefix("ide-v")}. Each file's SHA-256 checksum is listed in <a href="{GH}SHA256SUMS.txt">SHA256SUMS.txt</a>. Need help? <a href="/contact">Contact us</a>.</p>
</div></section>
</main>
<script>
(function(){{
  var BASE="{DL}", soon=" (available soon)";
  function off(a){{a.removeAttribute("href");a.removeAttribute("download");a.setAttribute("aria-disabled","true");a.style.opacity=".55";a.style.cursor="default";if(a.textContent.indexOf(soon)<0)a.textContent+=soon;}}
  function probe(url,ok,bad){{var i=new Image();var t=setTimeout(function(){{i.onload=i.onerror=null;bad();}},8000);i.onload=function(){{clearTimeout(t);ok();}};i.onerror=function(){{clearTimeout(t);bad();}};i.src=url+(url.indexOf("?")<0?"?":"&")+"t="+Date.now();}}
  var files=document.querySelectorAll("a[data-released]");
  files.forEach(function(a){{var f=a.getAttribute("data-file");
    probe(BASE+"status/{TAG}/"+encodeURIComponent(f)+".gif",function(){{a.href=BASE+f;}},function(){{}});}});
  probe("{WEB}icons/icon-192.png",function(){{}},function(){{
    document.querySelectorAll("a[data-web]").forEach(off);
    var s=document.getElementById("dl-status");
    if(s)s.textContent="The online service at ide.softwareequality.com is launching. You can download now; the apps connect and let you sign in as soon as it is live.";}});
  // Put the visitor's own platform first, as on the Business AI Manager download page.
  var ua=navigator.userAgent, ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  var id=ios?"dl-ios":/Android/.test(ua)?"dl-apk":/Windows/.test(ua)?"dl-windows":/Mac OS X/.test(ua)?"dl-mac":/CrOS/.test(ua)?"dl-web":/Linux/.test(ua)?"dl-linux":/BSD|SunOS/.test(ua)?"dl-unix":"";
  var c=id&&document.getElementById(id);if(c&&c.parentNode){{c.parentNode.insertBefore(c,c.parentNode.firstElementChild);c.style.borderColor="#1d4ed8";c.style.boxShadow="0 0 0 2px #1d4ed8 inset";}}
}})();
</script>
'''

src = (SITE / "aepx-ide.html").read_text().split("\n")
start = next(i for i, l in enumerate(src) if l.startswith('<div id="main"'))
tail_from = start + [i for i, l in enumerate(src[start:]) if l == "</section>"][2] + 1  # after hero, features, plans
head = "\n".join(src[:start])
title = "Download AEP-X Agentic IDE | Windows, Mac, Linux, Unix, Android, iPhone | Equality Software"
desc = ("Download AEP-X Agentic IDE by Equality Software for Windows, Mac, Linux, Android (APK) and iPhone, "
        "or use it in your browser on any system, including Unix. 30 days free, then £4.99/month or free with ads.")
head = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title)}</title>", head)
for k in ('meta name="description" content="', 'og:description" content="', 'twitter:description" content="'):
    head = re.sub(re.escape(k) + r'[^"]*', k + html.escape(desc), head)
for k in ('og:title" content="', 'twitter:title" content="'):
    head = re.sub(re.escape(k) + r'[^"]*', k + html.escape(title), head)
head = head.replace('https://softwareequality.com/aepx-ide"', 'https://softwareequality.com/aepx-ide-download"')
head = head.replace('{"@type": "ListItem", "position": 2, "name": "AEP-X Agentic IDE", "item": "https://softwareequality.com/aepx-ide-download"}',
                    '{"@type": "ListItem", "position": 2, "name": "AEP-X Agentic IDE", "item": "https://softwareequality.com/aepx-ide"}, '
                    '{"@type": "ListItem", "position": 3, "name": "Download", "item": "https://softwareequality.com/aepx-ide-download"}')
(SITE / "aepx-ide-download.html").write_text(head + "\n" + main + "\n".join(src[tail_from:]))
print("written", SITE / "aepx-ide-download.html")
