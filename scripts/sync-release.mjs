// 发布快照同步：dsh-flowchart-plugin 源码 + 构建产物 → dsh-flowchart-release/（免构建安装包）
// 用法：node scripts/sync-release.mjs [--skip-build]
// 说明：dsh-flowchart-release 是发布快照（含 install.ps1 专属文件），本脚本只同步插件侧的
// 源码与构建产物，install.ps1 / 专属 README 由 release 目录自行维护。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const release = join(root, '..', 'dsh-flowchart-release')

const COPY_DIRS = ['lib', 'src', 'scripts', 'test']
const COPY_FILES = ['package.json', 'package-lock.json', 'LICENSE', 'CHANGELOG.md', 'cordis.patch.yml', 'schema.json']
// release 专属、不同步的文件（install.ps1 安装器、README.md 安装包用户文档）
const RELEASE_ONLY = new Set(['install.ps1', 'README.md'])

const skipBuild = process.argv.includes('--skip-build')

if (!existsSync(release)) {
  console.error('未找到发布目录: ' + release)
  process.exit(1)
}

if (!skipBuild) {
  console.log('== 构建 client bundle ==')
  execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' })
}

// 清空 release 中的可同步内容（保留专属文件）
for (const name of readdirSync(release)) {
  if (RELEASE_ONLY.has(name)) continue
  rmSync(join(release, name), { recursive: true, force: true })
}

// 复制文件与目录
for (const f of COPY_FILES) {
  const src = join(root, f)
  if (existsSync(src)) cpSync(src, join(release, f))
}
for (const d of COPY_DIRS) {
  const src = join(root, d)
  if (existsSync(src)) cpSync(src, join(release, d), { recursive: true })
}

// 报告同步结果
const countFiles = (dir) => {
  let n = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) n += countFiles(p)
    else n++
  }
  return n
}
console.log('== 同步完成 ==')
console.log('来源   : ' + relative(process.cwd(), root))
console.log('发布包 : ' + relative(process.cwd(), release))
console.log('文件数 : ' + countFiles(release))
console.log('（install.ps1 等 release 专属文件已保留）')
