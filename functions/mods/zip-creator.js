import JSZip from "jszip"

// TODO error handling, more 400 responses / reply with mods that are missing as well
export async function onRequest(context) {
    const request = context.request
    const { searchParams } = new URL(request.url)
    const errorResponse = new Response("Invalid query", { status: 400 })
    const version = searchParams.get("version")
    const mods = searchParams.getAll("mod")
    if (version == undefined || mods.length == 0) {
        return errorResponse
    }
    let urls
    try {
        urls = (await getMods(version, mods)).map(it => it.url)
    } catch (e) {
        return new Response("Unable to access MCSR metadata", { status: 503 })
    }
    const allMods = await Promise.all(urls.map(it => fetch(it).then(async response => {
        if (!response.ok) {
            throw new Error("http error, status: " + response.status)
        }
        const filename = it.substring(Math.max(it.lastIndexOf("/"), it.lastIndexOf("=")) + 1)
        return { filename: filename, data: await response.bytes() }
    })))
    const zip = new JSZip()
    for (const modInfo of allMods) {
        zip.file(modInfo.filename, modInfo.data)
    }
    const blob = await zip.generateAsync({ type: "blob" })
    return new Response(blob, {
        message: "",
        headers: {
            "Content-Type": "application/x-modrinth-modpack+zip",
            "Content-Disposition": "attachment; filename=mods.zip"
        }
    })
}

async function getMods(version, mods) {
    return Promise.all([
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/mods.json"),
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/extra.json")
    ].map(promise => promise.then(response => {
        if (!response.ok) {
            throw new Error("http error, status: " + response.status)
        }
        return response.json()
    }))).then(([legal, other]) => {
        const modVersions = []
        for (const mod of [...legal.mods, ...other.mods]) {
            if (!mods.includes(mod.modid)) continue
            const modVersion = mod.versions.find(it => it.target_version.includes(version))
            if (modVersion == undefined) continue
            modVersions.push(modVersion)
        }
        return modVersions
    })
}
