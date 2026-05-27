
const versions = []

document.addEventListener("DOMContentLoaded", () => {
    fetch(meta).then(response => {
        if (!response.ok) {
            throw new Error("http error, status: " + response.status)
        }
        return response.json()
    }).then(it => setVersionOptions(it.mods))

    document.querySelector("#generate").addEventListener("click", () => {
        const version = document.querySelector("#version-dropdown").value
        if (!versions.includes(version)) return null

        fetch("https://meta.fabricmc.net/v2/versions/loader")
            .then(res => res.json())
            .catch(() => alert("Could not get Fabric Loader version"))
            .then(data => generateInstance(version, data[0].version))
    })
})

lwjglMap = [
    ["1.13", "3.3.3"],
    ["1.8.2", "2.9.4-nightly-20150209"],
    ["1.7.5", "	2.9.1"],
    ["1.7.3", "2.9.1-nightly-20131120"],
    ["1.0.0", "2.9.0"]
]

function getIntermediary(version) {
    if (semverCompare("1.3-", version) < 0) {
        return IntermediaryType.Ornithe
    } else if (semverCompare("1.6-", version) < 0) {
        return IntermediaryType.LegacyFabricNoAppletOldArgs
    } else if (semverCompare("1.7-", version) < 0) {
        return IntermediaryType.LegacyFabricNoApplet
    } else if ((version.split(".").length == 2 && semverCompare("1.9-", version) >= 0) || version == specialVersions["1.RV-Pre1"]) {
        return IntermediaryType.LegacyFabricV2
    } else {
        return IntermediaryType.LegacyFabric
    }
}


function process(subject, loader, version, fixed, lwjgl) {
    subject = subject.replaceAll("${loader_version}", loader)
    subject = subject.replaceAll("${minecraft_version}", version)
    subject = subject.replaceAll("${minecraft_version_fixed}", fixed == undefined ? version : fixed)
    subject = subject.replaceAll("${lwjgl_version}", lwjgl)
    subject = subject.replaceAll("${lwjgl_name}", lwjgl[0] == "3" ? "LWJGL 3" : "LWJGL 2")
    subject = subject.replaceAll("${lwjgl_uid}", lwjgl[0] == "3" ? "org.lwjgl3" : "org.lwjgl")
    return subject
}

const IntermediaryType = {
    LegacyFabric: "net.fabricmc.intermediary.json",
    LegacyFabricNoAppletOldArgs: "net.fabricmc.intermediary.pre-1.6.json",
    LegacyFabricNoApplet: "net.fabricmc.intermediary.1.6.x.json",
    LegacyFabricV2: "net.fabricmc.intermediary.v2.json",
    Ornithe: "net.fabricmc.intermediary.ornithe.pre-1.6.json"
}


function fixVersion(candidate, intermediary) {
    if (candidate.indexOf(".") == -1 || intermediary != IntermediaryType.Ornithe) return undefined
    if (candidate == "1.0") candidate += ".0"
    if (candidate.split(".")[1] < 3) candidate += "-client"
    return candidate
}

function getLwjgl(version) {
    for ([min, lwjgl] of lwjglMap) {
        if (semverCompare(min, version) >= 0) {
            return lwjgl
        }
    }
    throw new Error("unreachable")
}

async function generateInstance(version, loader) {
    const lwjgl = getLwjgl(version)
    const intermediary = getIntermediary(version)
    const fixed = fixVersion(version, intermediary)
    Promise.all([
        fetch("./instance.cfg"),
        fetch("./mmc-pack.json"),
        fetch("./patches/" + intermediary)
    ].map(promise => promise.then(res => {
        if (!res.ok) throw Error("error in fetching instance components")
        return res.text()
    }).then(it => process(it, loader, version, fixed, lwjgl)))).then(([cfg, pack, patch]) => {
            const zip = new JSZip()
            zip.file("instance.cfg", cfg)
            zip.file("mmc-pack.json", pack)
            zip.file("patches/net.fabricmc.intermediary.json", patch)
            zip.generateAsync({ type: "blob" })
                .then(it => downloadBlob(it, `${version}+loader.${loader}.zip`, "application/zip"))

        })
}

function setVersionOptions(mods) {
    const datalist = document.querySelector("#version-dropdown")

    for (const mod of mods) {
        for (const version of mod.versions) {
            for (const target_version of version.target_version) {
                if (semverCompare("1.14-", target_version) >= 0) continue
                if (versions.includes(target_version)) continue
                versions.push(target_version)
            }
        }
    }

    versions.sort(semverCompare)

    for (const version of versions) {
        let option = new Option()
        option.textContent = version
        datalist.appendChild(option)
    }
}


// javascript modules seem to be incompatible with how I'm doing event listeners. horray for copying code!

const specialVersions = {
    "15w14a": "1.8.3-",
    "1.RV-Pre1": "1.9.3-",
    "3D Shareware v1.34": "1.14-",
    "20w14infinite": "1.16-",
    "22w13oneblockatatime": "1.19-",
    "23w13a_or_b": "1.19.3-",
    "24w14potato": "1.20.5-",
    "25w14craftmine": "1.21.6-"
}

const meta = "https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/mods.json"

function semverCompare(a, b) {
    // arbitrary semver
    if (a == b) return 0
    a = (specialVersions[a] ?? a).split(".")
    b = (specialVersions[b] ?? b).split(".")
    const max_len = Math.max(a.length, b.length)
    for (let i = 0; i < max_len; i++) {
        a_i = parseInt(a[i] ?? 0)
        b_i = parseInt(b[i] ?? 0)
        if (a_i != b_i) return b_i - a_i
    }
    a_pre = a.at(-1).split("-")[1]
    b_pre = b.at(-1).split("-")[1]
    if (a_pre == b_pre) return 0
    if (a_pre == undefined) return -1
    if (b_pre == undefined) return 1
    return b_pre.localeCompare(a_pre, "en_US")
}

function downloadBlob(blob, name, mime) {
    const blobUrl = URL.createObjectURL(blob)
    const tempLink = document.createElement("a")
    tempLink.href = blobUrl
    tempLink.download = name
    tempLink.type = mime
    tempLink.click()
    URL.revokeObjectURL(blobUrl)
}
