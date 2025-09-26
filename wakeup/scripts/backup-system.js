#!/usr/bin/env node

/**
 * WakeUp アプリケーション - 自動バックアップ & ディザスタリカバリシステム
 */

const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

class BackupSystem {
  constructor(config = {}) {
    this.config = {
      backupDir: config.backupDir || './backups',
      retentionDays: config.retentionDays || 30,
      compression: config.compression || true,
      encryption: config.encryption || true,
      destinations: config.destinations || ['local', 's3'],
      schedule: config.schedule || {
        full: '0 2 * * 0', // 毎週日曜日 2:00 AM
        incremental: '0 2 * * 1-6', // 月〜土 2:00 AM
        snapshot: '*/30 * * * *' // 30分間隔
      },
      ...config
    }

    this.backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * メインバックアップ実行
   */
  async executeBackup(type = 'incremental') {
    console.log(`🔄 Starting ${type} backup: ${this.backupId}`)
    const startTime = Date.now()

    try {
      // バックアップディレクトリ作成
      await this.ensureBackupDirectory()

      const backupManifest = {
        id: this.backupId,
        type: type,
        timestamp: new Date().toISOString(),
        status: 'running',
        components: []
      }

      // 各コンポーネントのバックアップ
      if (type === 'full' || type === 'incremental') {
        await this.backupDatabase(backupManifest)
        await this.backupFiles(backupManifest)
        await this.backupConfiguration(backupManifest)
        await this.backupLogs(backupManifest)
      }

      if (type === 'snapshot') {
        await this.backupSystemSnapshot(backupManifest)
      }

      // Redis データ
      await this.backupRedis(backupManifest)

      // SSL証明書
      await this.backupSSLCertificates(backupManifest)

      // バックアップの整合性チェック
      await this.verifyBackupIntegrity(backupManifest)

      // 圧縮・暗号化
      if (this.config.compression || this.config.encryption) {
        await this.compressAndEncrypt(backupManifest)
      }

      // リモートストレージへのアップロード
      await this.uploadToRemoteStorage(backupManifest)

      // 古いバックアップのクリーンアップ
      await this.cleanupOldBackups()

      backupManifest.status = 'completed'
      backupManifest.duration = Date.now() - startTime
      backupManifest.size = await this.calculateBackupSize()

      // マニフェストファイル保存
      await this.saveManifest(backupManifest)

      console.log(`✅ Backup completed successfully: ${this.backupId}`)
      console.log(`📊 Duration: ${backupManifest.duration}ms, Size: ${this.formatSize(backupManifest.size)}`)

      return backupManifest

    } catch (error) {
      console.error(`❌ Backup failed: ${error.message}`)
      await this.handleBackupFailure(error)
      throw error
    }
  }

  /**
   * データベースバックアップ
   */
  async backupDatabase(manifest) {
    console.log('📊 Backing up database...')

    const component = {
      name: 'database',
      type: 'supabase',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Supabase データバックアップ（実際の実装では API を使用）
      const backupPath = path.join(this.getBackupPath(), 'database')
      await fs.mkdir(backupPath, { recursive: true })

      // テーブル構造とデータをバックアップ
      const tables = ['users', 'messages', 'rooms', 'user_sessions']

      for (const table of tables) {
        try {
          // 実際の実装では Supabase API または pg_dump を使用
          const dumpCommand = `pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -t ${table} --no-password > ${backupPath}/${table}.sql`
          await execAsync(dumpCommand)

          component.tables = component.tables || []
          component.tables.push({
            name: table,
            status: 'completed',
            size: (await fs.stat(`${backupPath}/${table}.sql`)).size
          })
        } catch (error) {
          console.warn(`⚠️ Warning: Failed to backup table ${table}: ${error.message}`)
          component.tables.push({
            name: table,
            status: 'failed',
            error: error.message
          })
        }
      }

      component.status = 'completed'
      component.duration = Date.now() - component.startTime

    } catch (error) {
      component.status = 'failed'
      component.error = error.message
      throw new Error(`Database backup failed: ${error.message}`)
    }

    manifest.components.push(component)
  }

  /**
   * ファイルシステムバックアップ
   */
  async backupFiles(manifest) {
    console.log('📁 Backing up files...')

    const component = {
      name: 'files',
      type: 'filesystem',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      const backupPath = path.join(this.getBackupPath(), 'files')
      await fs.mkdir(backupPath, { recursive: true })

      // 重要なディレクトリをバックアップ
      const importantDirs = [
        { src: './uploads', dest: 'uploads' },
        { src: './public', dest: 'public' },
        { src: './docs', dest: 'docs' },
        { src: './scripts', dest: 'scripts' },
        { src: './monitoring', dest: 'monitoring' }
      ]

      component.directories = []

      for (const dir of importantDirs) {
        try {
          const srcPath = path.resolve(dir.src)
          const destPath = path.join(backupPath, dir.dest)

          // ディレクトリが存在するかチェック
          try {
            await fs.access(srcPath)
          } catch {
            continue // ディレクトリが存在しない場合はスキップ
          }

          // rsync を使用して効率的にバックアップ
          const rsyncCommand = `rsync -av --delete "${srcPath}/" "${destPath}/"`
          await execAsync(rsyncCommand)

          const dirSize = await this.calculateDirectorySize(destPath)
          component.directories.push({
            name: dir.dest,
            status: 'completed',
            size: dirSize
          })

        } catch (error) {
          console.warn(`⚠️ Warning: Failed to backup directory ${dir.src}: ${error.message}`)
          component.directories.push({
            name: dir.dest,
            status: 'failed',
            error: error.message
          })
        }
      }

      component.status = 'completed'
      component.duration = Date.now() - component.startTime

    } catch (error) {
      component.status = 'failed'
      component.error = error.message
      throw new Error(`File backup failed: ${error.message}`)
    }

    manifest.components.push(component)
  }

  /**
   * 設定ファイルバックアップ
   */
  async backupConfiguration(manifest) {
    console.log('⚙️ Backing up configuration...')

    const component = {
      name: 'configuration',
      type: 'config',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      const backupPath = path.join(this.getBackupPath(), 'config')
      await fs.mkdir(backupPath, { recursive: true })

      // 重要な設定ファイル
      const configFiles = [
        'package.json',
        'next.config.js',
        'docker-compose.prod.yml',
        'docker-compose.monitoring.yml',
        'nginx/nginx.prod.conf',
        '.env.production',
        'monitoring/prometheus.yml',
        'monitoring/alert_rules.yml'
      ]

      component.files = []

      for (const file of configFiles) {
        try {
          const srcPath = path.resolve(file)
          const fileName = path.basename(file)
          const destPath = path.join(backupPath, fileName)

          await fs.copyFile(srcPath, destPath)

          const fileSize = (await fs.stat(destPath)).size
          component.files.push({
            name: fileName,
            status: 'completed',
            size: fileSize
          })

        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.warn(`⚠️ Warning: Failed to backup config ${file}: ${error.message}`)
          }
          component.files.push({
            name: path.basename(file),
            status: 'skipped',
            reason: 'File not found or inaccessible'
          })
        }
      }

      component.status = 'completed'
      component.duration = Date.now() - component.startTime

    } catch (error) {
      component.status = 'failed'
      component.error = error.message
    }

    manifest.components.push(component)
  }

  /**
   * Redisデータバックアップ
   */
  async backupRedis(manifest) {
    console.log('🔴 Backing up Redis data...')

    const component = {
      name: 'redis',
      type: 'cache',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      const backupPath = path.join(this.getBackupPath(), 'redis')
      await fs.mkdir(backupPath, { recursive: true })

      // Redis データダンプ作成
      const rdbCommand = 'docker-compose exec redis redis-cli SAVE'
      await execAsync(rdbCommand)

      // RDB ファイルをコピー
      const copyCommand = `docker cp $(docker-compose ps -q redis):/data/dump.rdb ${backupPath}/dump.rdb`
      await execAsync(copyCommand)

      const rdbSize = (await fs.stat(path.join(backupPath, 'dump.rdb'))).size

      component.status = 'completed'
      component.duration = Date.now() - component.startTime
      component.size = rdbSize

    } catch (error) {
      component.status = 'failed'
      component.error = error.message
      console.warn(`⚠️ Warning: Redis backup failed: ${error.message}`)
    }

    manifest.components.push(component)
  }

  /**
   * SSL証明書バックアップ
   */
  async backupSSLCertificates(manifest) {
    console.log('🔐 Backing up SSL certificates...')

    const component = {
      name: 'ssl',
      type: 'security',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      const backupPath = path.join(this.getBackupPath(), 'ssl')
      await fs.mkdir(backupPath, { recursive: true })

      const sslFiles = ['nginx/ssl/cert.pem', 'nginx/ssl/key.pem']
      component.certificates = []

      for (const file of sslFiles) {
        try {
          const srcPath = path.resolve(file)
          const fileName = path.basename(file)
          const destPath = path.join(backupPath, fileName)

          await fs.copyFile(srcPath, destPath)

          // 証明書情報を取得
          if (fileName === 'cert.pem') {
            try {
              const { stdout } = await execAsync(`openssl x509 -in "${destPath}" -noout -dates`)
              component.certificateInfo = stdout
            } catch (e) {
              // 証明書情報の取得に失敗した場合は続行
            }
          }

          const fileSize = (await fs.stat(destPath)).size
          component.certificates.push({
            name: fileName,
            status: 'completed',
            size: fileSize
          })

        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.warn(`⚠️ Warning: Failed to backup SSL file ${file}: ${error.message}`)
          }
          component.certificates.push({
            name: path.basename(file),
            status: 'skipped',
            reason: 'File not found'
          })
        }
      }

      component.status = 'completed'
      component.duration = Date.now() - component.startTime

    } catch (error) {
      component.status = 'failed'
      component.error = error.message
    }

    manifest.components.push(component)
  }

  /**
   * バックアップ整合性検証
   */
  async verifyBackupIntegrity(manifest) {
    console.log('🔍 Verifying backup integrity...')

    const verification = {
      startTime: Date.now(),
      status: 'running',
      checks: []
    }

    try {
      const backupPath = this.getBackupPath()

      // 各コンポーネントの整合性をチェック
      for (const component of manifest.components) {
        const check = {
          component: component.name,
          status: 'running'
        }

        try {
          const componentPath = path.join(backupPath, component.name)

          // ディレクトリの存在確認
          await fs.access(componentPath)

          // ファイルサイズチェック
          const stats = await fs.stat(componentPath)
          if (stats.isDirectory()) {
            const size = await this.calculateDirectorySize(componentPath)
            check.size = size
            check.status = size > 0 ? 'passed' : 'warning'
            check.message = size > 0 ? 'Directory contains data' : 'Directory is empty'
          } else {
            check.size = stats.size
            check.status = stats.size > 0 ? 'passed' : 'failed'
            check.message = stats.size > 0 ? 'File has content' : 'File is empty'
          }

        } catch (error) {
          check.status = 'failed'
          check.error = error.message
        }

        verification.checks.push(check)
      }

      const passedChecks = verification.checks.filter(c => c.status === 'passed').length
      const totalChecks = verification.checks.length

      verification.status = passedChecks === totalChecks ? 'passed' :
                           passedChecks > 0 ? 'warning' : 'failed'
      verification.summary = `${passedChecks}/${totalChecks} checks passed`
      verification.duration = Date.now() - verification.startTime

      if (verification.status === 'failed') {
        throw new Error(`Backup integrity verification failed: ${verification.summary}`)
      }

      if (verification.status === 'warning') {
        console.warn(`⚠️ Backup verification completed with warnings: ${verification.summary}`)
      }

    } catch (error) {
      verification.status = 'failed'
      verification.error = error.message
      throw new Error(`Backup verification failed: ${error.message}`)
    }

    manifest.verification = verification
  }

  /**
   * バックアップの圧縮・暗号化
   */
  async compressAndEncrypt(manifest) {
    if (!this.config.compression && !this.config.encryption) return

    console.log('🗜️ Compressing and encrypting backup...')

    const backupPath = this.getBackupPath()
    const archiveName = `${this.backupId}.tar`
    const compressedName = `${archiveName}.gz`
    const encryptedName = `${compressedName}.enc`

    try {
      // TAR アーカイブ作成
      const tarCommand = `tar -cf "${path.join(this.config.backupDir, archiveName)}" -C "${backupPath}" .`
      await execAsync(tarCommand)

      // 圧縮
      if (this.config.compression) {
        const gzipCommand = `gzip "${path.join(this.config.backupDir, archiveName)}"`
        await execAsync(gzipCommand)
      }

      // 暗号化
      if (this.config.encryption) {
        const encryptCommand = `openssl enc -aes-256-cbc -salt -in "${path.join(this.config.backupDir, compressedName)}" -out "${path.join(this.config.backupDir, encryptedName)}" -pass pass:${process.env.BACKUP_ENCRYPTION_KEY || 'default-key'}`
        await execAsync(encryptCommand)

        // 元ファイルを削除
        await fs.unlink(path.join(this.config.backupDir, compressedName))

        manifest.encrypted = true
        manifest.archiveFile = encryptedName
      } else {
        manifest.archiveFile = compressedName
      }

      manifest.compressed = true

      // 元のバックアップディレクトリを削除
      await execAsync(`rm -rf "${backupPath}"`)

    } catch (error) {
      throw new Error(`Compression/encryption failed: ${error.message}`)
    }
  }

  /**
   * リモートストレージアップロード
   */
  async uploadToRemoteStorage(manifest) {
    if (!this.config.destinations.includes('s3') && !this.config.destinations.includes('gcs')) {
      return
    }

    console.log('☁️ Uploading to remote storage...')

    const uploads = []

    try {
      // S3 アップロード
      if (this.config.destinations.includes('s3')) {
        const s3Upload = await this.uploadToS3(manifest)
        uploads.push(s3Upload)
      }

      // Google Cloud Storage アップロード
      if (this.config.destinations.includes('gcs')) {
        const gcsUpload = await this.uploadToGCS(manifest)
        uploads.push(gcsUpload)
      }

      manifest.remoteUploads = uploads

    } catch (error) {
      console.warn(`⚠️ Warning: Remote upload failed: ${error.message}`)
      manifest.remoteUploads = uploads.concat([{
        destination: 'remote',
        status: 'failed',
        error: error.message
      }])
    }
  }

  /**
   * S3アップロード
   */
  async uploadToS3(manifest) {
    const upload = {
      destination: 's3',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      const archivePath = path.join(this.config.backupDir, manifest.archiveFile)
      const s3Key = `backups/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${manifest.archiveFile}`

      // AWS CLI を使用してアップロード
      const uploadCommand = `aws s3 cp "${archivePath}" "s3://${process.env.S3_BACKUP_BUCKET}/${s3Key}"`
      await execAsync(uploadCommand)

      upload.status = 'completed'
      upload.duration = Date.now() - upload.startTime
      upload.s3Key = s3Key
      upload.bucket = process.env.S3_BACKUP_BUCKET

    } catch (error) {
      upload.status = 'failed'
      upload.error = error.message
    }

    return upload
  }

  /**
   * ディザスタリカバリ実行
   */
  async executeDisasterRecovery(backupId) {
    console.log(`🚨 Starting disaster recovery from backup: ${backupId}`)

    try {
      // バックアップマニフェストを読み込み
      const manifest = await this.loadBackupManifest(backupId)

      // システム停止
      await this.stopServices()

      // データベース復旧
      await this.restoreDatabase(manifest)

      // ファイル復旧
      await this.restoreFiles(manifest)

      // 設定復旧
      await this.restoreConfiguration(manifest)

      // サービス再起動
      await this.startServices()

      // 復旧検証
      await this.verifyRecovery()

      console.log('✅ Disaster recovery completed successfully')

    } catch (error) {
      console.error(`❌ Disaster recovery failed: ${error.message}`)
      throw error
    }
  }

  /**
   * ヘルパーメソッド
   */
  getBackupPath() {
    return path.join(this.config.backupDir, this.backupId)
  }

  async ensureBackupDirectory() {
    const backupPath = this.getBackupPath()
    await fs.mkdir(backupPath, { recursive: true })
  }

  async calculateDirectorySize(dirPath) {
    let totalSize = 0
    const items = await fs.readdir(dirPath, { withFileTypes: true })

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        totalSize += await this.calculateDirectorySize(itemPath)
      } else {
        const stats = await fs.stat(itemPath)
        totalSize += stats.size
      }
    }

    return totalSize
  }

  async calculateBackupSize() {
    const backupPath = this.getBackupPath()
    return await this.calculateDirectorySize(backupPath)
  }

  formatSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  async saveManifest(manifest) {
    const manifestPath = path.join(this.config.backupDir, `${this.backupId}.json`)
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  }

  async cleanupOldBackups() {
    console.log('🧹 Cleaning up old backups...')

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

    try {
      const items = await fs.readdir(this.config.backupDir)
      let deletedCount = 0

      for (const item of items) {
        const itemPath = path.join(this.config.backupDir, item)
        const stats = await fs.stat(itemPath)

        if (stats.mtime < cutoffDate) {
          if (stats.isDirectory()) {
            await execAsync(`rm -rf "${itemPath}"`)
          } else {
            await fs.unlink(itemPath)
          }
          deletedCount++
        }
      }

      console.log(`🗑️ Deleted ${deletedCount} old backup files`)

    } catch (error) {
      console.warn(`⚠️ Warning: Cleanup failed: ${error.message}`)
    }
  }

  async handleBackupFailure(error) {
    console.error('📧 Sending backup failure notification...')

    // 失敗通知（実装例）
    const notification = {
      timestamp: new Date().toISOString(),
      backupId: this.backupId,
      error: error.message,
      stack: error.stack
    }

    // ログファイルに記録
    const logPath = path.join(this.config.backupDir, 'backup-errors.log')
    await fs.appendFile(logPath, JSON.stringify(notification) + '\n')
  }
}

// CLI実行
if (require.main === module) {
  const backupType = process.argv[2] || 'incremental'
  const backup = new BackupSystem()

  backup.executeBackup(backupType)
    .then(manifest => {
      console.log('📋 Backup manifest:', JSON.stringify(manifest, null, 2))
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Backup failed:', error.message)
      process.exit(1)
    })
}

module.exports = BackupSystem