import * as fs from "node:fs"

import { execSync } from "node:child_process"

import gulp from "gulp"
import RevAll from "gulp-rev-all"

fs.rmSync("dist", { recursive: true, force: true })
fs.cpSync("src", "dist", { recursive: true })

gulp.src(["src/**{html, css, js}", "!src/vendor/**" ])
    .pipe(RevAll.revision({ dontRenameFile: [ ".html" ] }))
    .pipe(gulp.dest("dist"))

fs.rmSync(".rules", { recursive: true, force: true })
execSync("git clone --depth 1 https://github.com/Minecraft-Java-Edition-Speedrunning/rules .rules")
fs.cpSync(".rules/pub/pdf", "dist/rules", { recursive: true })
fs.rmSync(".rules", { recursive: true, force: true })
