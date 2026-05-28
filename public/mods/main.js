import "jszip"

var multiSelect = false
var checkboxes = [];
var legalMods = null
var otherMods = null
var allMods = null
var versions = []
var currConfig = null
var showObsolete = false
var warnedOptiFine = false
var warnedExtraOptions = false

const Category = {
    RANDOM_SEED: "random_seed",
    SET_SEED: "set_seed"
}

var category = Category.RANDOM_SEED

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

const topVersions = ["1.16.1", "1.15.2", "1.11.2", "1.8.9", "1.7.10", "1.16.5", "1.12.2", "1.8", "1.12", "20w14infinite"]

function setVersionOptions() {
    const sellist = document.querySelector("#version-dropdown")

    for (const mod of legalMods) {
        for (const version of mod.versions) {
            for (const target_version of version.target_version) {
                if (!versions.includes(target_version)) {
                    versions.push(target_version)
                }
            }
        }
    }

    versions.sort(semverCompare)

    const topVersionsSort = versions.filter(version => !topVersions.includes(version) && version != "1.13.2")
    topVersionsSort.unshift(...topVersions)
    topVersionsSort.push("1.13.2")

    for (const version of topVersionsSort) {
        let option = new Option()
        option.textContent = version
        sellist.appendChild(option)
    }
}

function semverCompare(a, b) {
    // arbitrary semver
    if (a == b) return 0
    a = (specialVersions[a] ?? a).split(".")
    b = (specialVersions[b] ?? b).split(".")
    const max_len = Math.max(a.length, b.length)
    for (let i = 0; i < max_len; i++) {
        const a_i = parseInt(a[i] ?? 0)
        const b_i = parseInt(b[i] ?? 0)
        if (a_i != b_i) return b_i - a_i
    }
    const a_pre = a.at(-1).split("-")[1]
    const b_pre = b.at(-1).split("-")[1]
    if (a_pre == b_pre) return 0
    if (a_pre == undefined) return -1
    if (b_pre == undefined) return 1
    return b_pre.localeCompare(a_pre, "en_US")
}

function filterMods(config) {
    const obsoletePredicate = mod => !showObsolete && (mod.obsolete || currVersionOf(mod, config.version).obsolete)
    let legal = filterModsInner(legalMods, config, mod => !obsoletePredicate(mod))
    let other = filterModsInner(otherMods, config)
    let obsolete = filterModsInner(legalMods, config, mod => obsoletePredicate(mod))
    return [legal, other, obsolete]
}

function filterModsInner(mods, config, predicate = _ => true) {
    const res = []
    outer: for (const mod of mods) {
        for (const version of mod.versions) {
            if (version.target_version.includes(config.version) && checkRules(mod, config) && predicate(mod)) {
                res.push(mod)
                continue outer
            }
        }
    }
    return res
}

function checkRules(mod, config) {
    if (config.macos && mod.modid == "sodium" && currVersionOf(modFromModid("sodiummac"), config.version) != undefined) return false
    if (mod.traits == undefined) return true
    if (mod.traits.includes("mac-only") && !config.macos) return false
    if (mod.traits.includes("ssg-only") && config.category != Category.SET_SEED) return false
    if (mod.traits.includes("rsg-only") && config.category != Category.RANDOM_SEED) return false
    return true
}

/**
 * 
 * @param {*} mod the mod to search
 * @param {*} version the minecraft version compatibility is requested for
 * @returns the modVersion that includes the target version, or null
 */
function currVersionOf(mod, version) {
    return mod.versions.find(modVersion => modVersion.target_version.includes(version))
}

function refreshMods(config) {
    currConfig = config
    disableMultiSelect()
    checkboxes = []

    const [currLegalMods, currOtherMods, obsoleteMods] = filterMods(config)
    const ranked = currOtherMods.find(it => it.modid == "mcsrranked")
    if (ranked) {
        const idx = currOtherMods.indexOf(ranked)
        currOtherMods.splice(idx, 1)
        currOtherMods.unshift(ranked)
    }
    const obsoleteModids = obsoleteMods.map(it => it.modid)

    const legalDiv = document.querySelector("#legal")
    legalDiv.replaceChildren()
    for (const mod of currLegalMods) {
        const version = currVersionOf(mod, config.version)
        legalDiv.appendChild(createEntry(mod, version, obsoleteModids))
    }

    const otherDiv = document.querySelector("#other")
    otherDiv.replaceChildren()
    document.querySelectorAll(".other-text").forEach(it => it.hidden = currOtherMods.length == 0)
    for (const mod of currOtherMods) {
        const version = currVersionOf(mod, config.version)
        otherDiv.appendChild(createEntry(mod, version, obsoleteModids))
    }

    if (config.version in specialVersions) {
        document.querySelector("#af_text").classList.remove("hidden")
        document.querySelector("#legal_text").classList.add("hidden")
    } else {
        document.querySelector("#af_text").classList.add("hidden")
        document.querySelector("#legal_text").classList.remove("hidden")
    }

    const versionText = [document.querySelector("#v1_14-"), document.querySelector("#v1_3-1_13"), document.querySelector("#v1_0-1_2")]
    let idx
    if (semverCompare("1.14-", config.version) >= 0) idx = 0
    else if (semverCompare("1.3-", config.version) >= 0) idx = 1
    else idx = 2

    versionText.forEach(it => it.classList.add("hidden"))
    versionText[idx].classList.remove("hidden")
}

function createEntry(mod, version, obsoleteMods) {
    const details = document.createElement("details")
    details.classList.add("mod-entry")
    const summary = document.createElement("summary")
    summary.classList.add("legal-listing")
    var checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.classList.add("ms-checkbox", "hidden")
    checkbox.id = "ms-checkbox-" + mod.modid
    const label = document.createElement("label")
    label.classList.add("hidden", "ms-checkbox-label")
    label.htmlFor = checkbox.id
    const modName = document.createElement("span")
    modName.classList.add("name-align")
    const versionSpan = document.createElement("span")
    versionSpan.title = "ID: " + mod.modid
    const description = document.createElement("p")
    const download = document.createElement("a")
    download.href = version.url
    download.classList.add("button")
    download.classList.add("button-link")
    download.setAttribute("download", "")
    download.textContent = "Download"
    const homepage = document.createElement("a")
    homepage.href = mod.homepage;
    homepage.classList.add("button")
    homepage.classList.add("button-link")
    homepage.textContent = "Homepage";
    summary.addEventListener("click", summaryOnClick)
    const parts = getIncompatibilityAndDependencyText(mod, version, obsoleteMods).split("\n")
    const elements = []
    for (const part of parts) {
        elements.push(document.createTextNode(part))
        elements.push(document.createElement("hr"))
    }
    elements.pop()
    description.prepend(
        document.createTextNode(mod.description),
        ...elements,
        document.createElement("hr"),
        download,
        document.createTextNode(" "),
        homepage
    )
    modName.prepend(document.createTextNode(mod.name))
    versionSpan.prepend(document.createTextNode("v" + version.version))
    summary.prepend(modName, versionSpan)
    summary.prepend(checkbox, label)
    details.prepend(summary, description)
    checkboxes.push(checkbox)
    return details
}

function nicelyJoin(elements) {
    const data = [...elements]
    const last = data.pop()
    return (data.length == 0 ? last : data.join(", ") + " and " + last)
}

// const skipVersions = ["1.13.1", "1.12.1", "1.11.1", "1.11", "1.10.1", "1.10", "1.9.3", "1.9.2", "1.9.1", "1.9"]
// skipVersions.push(...Object.keys(specialVersions))

// function buildRanges(mod) {
//     const compatibleVersions = mod.versions.flatMap(it => it.target_version)
//     compatibleVersions.sort(semverCompare)

//     const ranges = []
//     let range = 0
//     if (!versions.includes(compatibleVersions[0])) {
//         throw new Error("unrecoverable")
//     }
//     let i = 0
//     let j = versions.indexOf(compatibleVersions[0])
//     while (i < compatibleVersions.length && j < versions.length) {
//         if (!versions.includes(compatibleVersions[i]) || skipVersions.includes(compatibleVersions[i])) {
//             i++
//             continue
//         }
//         if (skipVersions.includes(versions[j])) {
//             j++
//             continue
//         }
//         if (compatibleVersions[i] == versions[j]) {
//             (ranges[range] ?? (ranges[range] = [])).push(compatibleVersions[i])
//             i++
//             j++
//         } else {
//             if (ranges[range] != undefined) range++
//             j++
//         }
//     }
//     return ranges.map(it => it.length == 1 ? it : it[0] + "-" + it.at(-1))
// }

function getIncompatibilityAndDependencyText(mod, version, obsoleteMods) {
    let res = ""
    if (mod.incompatibilities != undefined) {
        const incompatibilities = mod.incompatibilities
            .filter(it => !obsoleteMods.includes(it) && modFromModid(it) != undefined)
            .map(id => modFromModid(id).name)
        if (incompatibilities.length > 0) res += "\nIncompatible with " + nicelyJoin(incompatibilities)
    }
    if (version.dependencies != undefined) {
        const dependencies = version.dependencies
            .filter(it => modFromModid(it) != undefined)
            .map(id => modFromModid(id).name)
        if (dependencies.length > 0) res += "\nDependent on " + nicelyJoin(dependencies)
    }
    const extraLine = extraMetaLine(mod.modid)
    if (extraLine) res += "\n" + extraLine
    // res += "\nAvailable for " + nicelyJoin(buildRanges(mod))
    return res
}

function summaryOnClick(e) {
    let target = e.target
    while (target.tagName != "SUMMARY") target = target.parentElement
    if (!target.classList.contains("legal-listing")) return

    if (!multiSelect) {
        // regular dropdown interaction
        if (!e.ctrlKey) return

        // ctrl key pressed, turn on multiselect and check the element clicked on
        e.preventDefault()
        enableMultiSelect()
        // reclick to make the actual selection after the checkbox is created
        this.click()
        return
    }

    // disable dropdown
    e.preventDefault()

    const checkbox = target.querySelector("input");

    // allow selecting an incompatible mod
    if (checkbox.classList.contains("incompatible") && !checkbox.classList.contains("override-incompatible")) {
        if (!e.ctrlKey) return
        checkbox.classList.add("override-incompatible")
    }

    if (checkbox.classList.contains("auto-dependency")) {
        checkbox.classList.remove("auto-dependency")
        checkbox.classList.add("prev-auto-dependency")
        return
    }

    if (checkbox.classList.contains("prev-auto-dependency") && !e.ctrlKey) {
        checkbox.classList.remove("prev-auto-dependency")
        checkbox.classList.add("auto-dependency")
        return
    }


    checkbox.checked = !checkbox.checked

    if (checkbox.checked) {
        autoSelectDeps(modidFromCheckbox(checkbox))
    } else {
        checkbox.classList.remove("override-incompatible")
    }

    updateState()

    // if (checkboxes.every(it => !it.checked)) {
    //     disableMultiSelect()
    // }
}

function autoSelectDeps(modid) {
    const deps = getDependencies(modid)
    for (const dep of deps) {
        const checkbox = checkboxFromModid(dep)
        if (checkbox == undefined) continue
        if (checkbox.classList.contains("incompatible")) {
            console.log("this shouldn't happen normally, decide on proper handling?")
            return
        }
        if (checkbox.checked) {
            checkbox.classList.add("prev-auto-dependency")
        } else {
            checkbox.checked = true
            checkbox.classList.add("auto-dependency")
        }
    }
}

function getDependencies(modid) {
    const initial = currVersionOf(modFromModid(modid), currConfig.version)?.dependencies
    if (initial == undefined) return []

    // baby's first dfs
    const found = []
    const queue = []
    for (const other of initial) {
        queue.push(other)
        found.push(other)
    }

    while (queue.length > 0) {
        const mod = modFromModid(queue.shift())
        if (mod == undefined) continue
        const version = currVersionOf(mod, currConfig.vesion)
        if (version == undefined || version.dependencies == undefined) continue
        for (const other of version.dependencies) {
            if (modid == other || found.includes(mod.modid)) continue
            found.push(other)
            queue.push(other)
        }
    }
    return found
}

function updateState() {
    // there's a good chance there's a lot of bugs in this method
    let anyRemoved
    let missingRequired
    let requiredBy
    do {
        anyRemoved = false
        missingRequired = {}
        requiredBy = {}
        for (const checkbox of checkboxes.filter(it => it.checked)) {
            const modid = modidFromCheckbox(checkbox)
            const deps = getDependencies(modid)
            for (const other of deps) {
                const checkbox = checkboxFromModid(other)
                if (checkbox == undefined) {
                    console.log("mod declares a dep not in list, how should this be handled?")
                    continue
                }
                if (checkbox.checked == false) {
                    const set = missingRequired[modid] ?? (missingRequired[modid] = new Set())
                    set.add(other)
                } else {
                    const set = requiredBy[other] ?? (requiredBy[other] = new Set())
                    set.add(modid)
                }
            }
        }

        for (const checkbox of checkboxes.filter(it => !it.classList.contains("auto-dependency"))) {
            const modid = modidFromCheckbox(checkbox)
            if (missingRequired[modid]?.size > 0) {
                checkbox.classList.add("missing-dependency")
            } else {
                checkbox.classList.remove("missing-dependency")
            }
        }

        for (const checkbox of checkboxes.filter(it => it.classList.contains("auto-dependency"))) {
            if (requiredBy[modidFromCheckbox(checkbox)] == undefined) {
                // changed the table, must reevaluate
                anyRemoved = true
                checkbox.checked = false
                checkbox.classList.remove("auto-dependency")
                checkbox.classList.remove("prev-auto-dependency")
            }
        }

        for (const checkbox of checkboxes.filter(it => it.classList.contains("prev-auto-dependency"))) {
            if (requiredBy[modidFromCheckbox(checkbox)] == undefined) {
                checkbox.classList.remove("prev-auto-dependency")
            }
        }
    } while (anyRemoved)

    const incompatibilities = {}
    // uncommended parts -> if uncommended, it will mark as incompatible mods that are incompatible with dependencies of selected mods,
    // even those dependencies are manually deselected 
    for (const checkbox of checkboxes /* .filter(it => !it.classList.contains("auto-dependency")) */) {
        const modid = modidFromCheckbox(checkbox)
        const deps = getDependencies(modid)
        deps.unshift(modid)
        for (const depModid of deps) {
            const mod = modFromModid(depModid)
            if (mod == undefined || mod.incompatibilities == undefined) continue
            for (const other of mod.incompatibilities) {
                const otherMod = checkboxFromModid(other)
                if (otherMod == undefined) continue
                // const lowerDeps = getDependencies(depModid)
                // const higherDeps = deps.filter(it => !lowerDeps.includes(it))
                // console.log("higher deps: ", higherDeps)
                // console.log(modid, depModid, other, otherMod.checked, higherDeps.find(it => checkboxFromModid(it)?.checked)?.checked ?? false)
                // if other mod is checked *or any mod that depends on other mod is checked*
                if (!otherMod.checked /* && checkboxes.filter(it => it.checked).find(it => getDependencies(modidFromCheckbox(it)).includes(other)) == undefined */) continue
                const set = incompatibilities[modid] ?? (incompatibilities[modid] = new Set())
                set.add(other)
            }
        }
    }

    for (const checkbox of checkboxes.filter(it => !it.checked || it.classList.contains("override-incompatible"))) {
        const modid = modidFromCheckbox(checkbox)
        if (incompatibilities[modid] == undefined) {
            checkbox.classList.remove("incompatible")
            checkbox.classList.remove("override-incompatible")
        }
        else checkbox.classList.add("incompatible")
    }

    // set title text
    for (const checkbox of checkboxes) {
        const modid = modidFromCheckbox(checkbox)
        const label = labelFromCheckbox(checkbox)
        label.title = getTitleText(incompatibilities[modid], missingRequired[modid], requiredBy[modid], checkbox.classList)
    }

    for (const checkbox of checkboxes.filter(it => it.checked)) {
        const modid = modidFromCheckbox(checkbox)
        if (modid == "optifine" && !warnedOptiFine)
            document.querySelector("#optifine-warning").classList.remove("hidden")
        else if (modid == "extra-options" && !warnedExtraOptions)
            document.querySelector("#accessibility-warning").classList.remove("hidden")
    }
}

function getTitleText(incompatibilities, missingRequired, requiredBy, classes) {
    let res = ""
    if (incompatibilities?.size > 0) {
        res += "Incompatible with " + nicelyJoin([...incompatibilities].map(it => modFromModid(it).name)) + "\n"
        if (!classes.contains("auto-dependency") && !classes.contains("override-incompatible")) res += "\n"
    }
    if (missingRequired?.size > 0)
        res += "Requires " + nicelyJoin([...missingRequired].map(it => modFromModid(it).name)) + ` but ${missingRequired.size == 1 ? "it is" : "they are"} not selected\n`
    if (requiredBy?.size > 0)
        res += "Required by " + nicelyJoin([...requiredBy].map(it => modFromModid(it).name)) + "\n"
    return res
}

/**
 * Gets the config represented by the current state of the website
 * @returns null if version is invalid, else object with fields version, macos, 
 */
function getConfig() {
    const dropdown = document.querySelector("#version-dropdown")
    const currVersion = dropdown.value
    if (!versions.includes(currVersion)) return null
    return {
        version: currVersion,
        category: document.querySelector("input[name=category]:checked").id,
        macos: document.querySelector("#macos").checked
    }
}

function handleQueryParameters() {
    const params = new URLSearchParams(window.location.search)
    const defaultMacOS = navigator.userAgentData?.platform == "macOS"
    let version = params.get("version") ?? "1.16.1"
    if (!versions.includes(version)) version = "1.16.1"
    let category = params.get("category") ?? Category.RANDOM_SEED
    if (!Object.values(Category).includes(category)) category = Category.RANDOM_SEED
    const macos = params.has("macos") ? true : defaultMacOS

    document.querySelector("#version-dropdown").value = version
    document.querySelector("#" + category).checked = true
    document.querySelector("#macos").checked = macos
}

function handleModQueryParameters() {
    const params = new URLSearchParams(window.location.search)
    if (params.has("recommended")) {
        document.querySelector("#sel-recommended").click()
        return
    }
    let mods = params.getAll("mod")
    if (mods.length == 0) return
    enableMultiSelect()
    checkboxes.forEach(checkbox => checkbox.checked = mods.includes(modidFromCheckbox(checkbox)))
    updateState()
}

function checkboxFromModid(modid) {
    return document.querySelector(`#ms-checkbox-${modid}`)
}

function labelFromModid(modid) {
    return document.querySelector(`#ms-checkbox-${modid}+label`)
}

function labelFromCheckbox(checkbox) {
    return checkbox.nextSibling
}

function modFromModid(modid) {
    return allMods.find(it => it.modid == modid)
}

function versionFromModid(modid, version) {
    const mod = modFromModid(modid)
    if (mod == undefined) return undefined
    return currVersionOf(mod, version)
}

function nameFromModid(modid) {
    return modFromModid(modid).name
}

function modidFromCheckbox(checkbox) {
    return checkbox.id.substring("ms-checkbox-".length)
}

function modFromCheckbox(checkbox) {
    const modid = modidFromCheckbox(checkbox)
    return modFromModid(modid)
}

function modVersionFromCheckbox(checkbox, version) {
    const mod = modFromCheckbox(checkbox)
    if (mod == undefined) return undefined
    return currVersionOf(mod, version)
}

document.addEventListener("DOMContentLoaded", () => {
    const textbox = document.querySelector("#warnings > summary")
    textbox.textContent = "Loading mods..."

    Promise.all([
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/mods.json"),
        fetch("https://raw.githubusercontent.com/tildejustin/mcsr-meta/schema-7/extra.json")
    ].map(promise => promise.then(response => {
        if (!response.ok) {
            throw new Error("http error, status: " + response.status)
        }
        return response.json()
    }))).then(([legal, other]) => {
        legalMods = legal["mods"]
        otherMods = other["mods"]
        allMods = legalMods.concat(otherMods)
        setVersionOptions()
        handleQueryParameters()
        refreshMods(getConfig())
        handleModQueryParameters()
    }).catch(e => {
        console.log(e)
        textbox.textContent = "Loading mods failed, that's not good"
    })

    document.querySelector("#sel-recommended").addEventListener("click", () => {
        if (!multiSelect) enableMultiSelect()
        checkboxes.forEach(it => it.checked = false)
        for (const checkbox of checkboxes) {
            const mod = modFromCheckbox(checkbox)
            const version = modVersionFromCheckbox(checkbox, currConfig.version)
            if (checkbox.closest("div").id != "legal") continue
            const recommended = (mod["recommended"] ?? true) && (version["recommended"] ?? true)
            if (recommended) checkbox.parentElement.click()
        }
        updateState()
    })

    // call the click event listener for a tags with no href
    document.querySelectorAll(".button, label").forEach(it => it.addEventListener("keyup", e => {
        if (e.code == "Space" || e.code == "Enter") {
            e.target.click()
        }
    }))

    document.querySelectorAll(".updates-list").forEach(it => it.addEventListener("change", () => {
        let config = getConfig()
        if (config != null) refreshMods(config)
    }))

    document.querySelector("#start-sel").addEventListener("click", () => enableMultiSelect())
    document.querySelector("#deselect-all").addEventListener("click", () => disableMultiSelect())

    document.querySelector("#mods-zip").addEventListener("click", e => {
        const config = currConfig
        const mods = selectedMods()
        if (mods.length == 0) {
            alert("No mods selected!")
            return
        }
        e.target.classList.add("disabled")
        const url = new URL("zip-creator/", document.baseURI)
        url.searchParams.append("version", config.version)
        for (const mod of mods) {
            url.searchParams.append("mod", mod)
        }
        fetch(url).then(res => {
            if (!res.ok) throw Error("Zip worker request failed")
            return res.blob()
        }).then(it => downloadBlob(it, "mods.zip", "application/zip"))
            .then(() => e.target.classList.remove("disabled"))
    })

    document.querySelector("#modpack").addEventListener("click", () => {
        const config = currConfig
        const versions = selectedVersions()
        if (versions.length == 0) {
            alert("No mods selected!")
            return
        }

        fetch("https://meta.fabricmc.net/v2/versions/loader")
            .then(res => res.json())
            .then(data => generateModpack(config, data[0].version, versions))
            .catch(() => alert("Could not get Fabric Loader version"))
    })

    document.querySelector("#ms-share").addEventListener("click", () => {
        const config = currConfig
        const url = new URL(window.location)
        const params = url.searchParams
        params.append("version", config.version)
        params.append("category", config.category)
        if (config.macos) params.append("macos", "")
        checkboxes.filter(it => it.checked).forEach(checkbox => params.append("mod", modidFromCheckbox(checkbox)))
        navigator.clipboard.writeText(url)
    })

    document.querySelector("#accessibility-warning>.closer").addEventListener("click", () => {
        warnedExtraOptions = true
        document.querySelector("#accessibility-warning").classList.add("hidden")
    })

    document.querySelector("#optifine-warning>.closer").addEventListener("click", () => {
        warnedOptiFine = true
        document.querySelector("#optifine-warning").classList.add("hidden")
    })

    document.querySelector("#obsolete").addEventListener("click", e => setObsolete(e.target.checked))
})

function extraMetaLine(modid) {
    switch (modid) {
        case "extra-options": return "Abusing this mod, such as measuring Ender Eyes on soul sand, is banned. Please read A.8.12 of the full rules to see what abuses are banned."
        case "chunkcacher":
        case "setspawnmod": return "This mod is only allowed for Set Seed speedruns."
        case "optifine": return "The default settings for OptiFine are not legal, and most extended options are banned. Please read A.8.1 of the full rules to fix the relevant settings. OptiFine is not allowed at all for glitched or oneshot runs."
    }
    return undefined
}

function selectedMods() {
    return checkboxes.filter(it => it.checked).map(checkbox => modidFromCheckbox(checkbox))
}

function selectedVersions() {
    return checkboxes.filter(it => it.checked).map(checkbox => modVersionFromCheckbox(checkbox, currConfig.version))
}

function generateModpack(config, loader, versions) {
    const id = `${config.version}-${config.category}` + (config.macos ? "-macos" : "")
    const index = {
        formatVersion: 1,
        game: "minecraft",
        versionId: id,
        name: "MCSR Mods",
        dependencies: {
            "fabric-loader": loader,
            "minecraft": config.version
        },
        files: versions.map(it => {
            return {
                path: "mods/" + it.url.substring(Math.max(it.url.lastIndexOf("/"), it.url.lastIndexOf("=")) + 1),
                hashes: {
                    sha1: it.sha1,
                    sha512: it.sha512
                },
                downloads: [it.url],
                fileSize: it.fileSize
            }
        })
    }
    const zip = new window.JSZip()
    zip.file("modrinth.index.json", JSON.stringify(index))
    zip.generateAsync({ type: "blob" })
        .then(it => downloadBlob(it, id + ".mrpack", "application/x-modrinth-modpack+zip"))
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

function enableMultiSelect() {
    document.querySelectorAll("summary.legal-listing").forEach(it => it.parentElement.open = false)
    // this doesn't do what it's supposed to but it removes the ::before element and that's good enough
    // I hate web development so much actually wtf is this behavior. it better be consistent.
    document.documentElement.style.setProperty("--symbol", "_")
    document.querySelectorAll(".ms-checkbox-label").forEach(it => it.classList.remove("hidden"))
    document.querySelectorAll(".ms-show").forEach(it => it.classList.remove("hidden"))
    document.querySelectorAll(".ms-hide").forEach(it => it.classList.add("hidden"))
    if (semverCompare("1.14-", currConfig.version) <= 0) {
        document.querySelector("#modpack").classList.add("hidden")
    } else {
        document.querySelector("#modpack").classList.remove("hidden")
    }
    multiSelect = true
}

function disableMultiSelect() {
    checkboxes.forEach(it => it.checked = false)
    // remove all extra classes
    updateState()
    document.documentElement.style.removeProperty("--symbol")
    document.querySelectorAll(".ms-checkbox-label").forEach(it => it.classList.add("hidden"))
    document.querySelectorAll(".ms-show").forEach(it => it.classList.add("hidden"))
    document.querySelectorAll(".ms-hide").forEach(it => it.classList.remove("hidden"))
    multiSelect = false
}

function setObsolete(obsolete) {
    showObsolete = obsolete
    refreshMods(currConfig)
}
