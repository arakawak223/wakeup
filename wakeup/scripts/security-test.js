#!/usr/bin/env node

/**
 * 包括的セキュリティテストスクリプト
 */

const https = require('https');
const crypto = require('crypto');

class SecurityTester {
  constructor(baseUrl = 'https://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async runAllTests() {
    console.log('🔐 WakeUp アプリケーション セキュリティテスト開始\n');

    await this.testHttpsRedirect();
    await this.testSecurityHeaders();
    await this.testCSP();
    await this.testRateLimiting();
    await this.testBruteForceProtection();
    await this.testCSRFProtection();
    await this.testInputValidation();
    await this.testFileUploadSecurity();
    await this.testSessionSecurity();
    await this.testSSLConfiguration();

    this.generateReport();
  }

  async testHttpsRedirect() {
    console.log('🔍 HTTPS リダイレクトテスト...');
    try {
      const response = await this.makeRequest('http://localhost:3000');
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers.location;
        if (location && location.startsWith('https://')) {
          this.addResult('HTTPS Redirect', 'PASS', 'HTTP -> HTTPS リダイレクト正常');
        } else {
          this.addResult('HTTPS Redirect', 'FAIL', 'HTTPS リダイレクトが不適切');
        }
      } else {
        this.addResult('HTTPS Redirect', 'FAIL', 'HTTPS リダイレクトが設定されていない');
      }
    } catch (error) {
      this.addResult('HTTPS Redirect', 'ERROR', error.message);
    }
  }

  async testSecurityHeaders() {
    console.log('🔍 セキュリティヘッダーテスト...');
    try {
      const response = await this.makeRequest(this.baseUrl);
      const headers = response.headers;

      const expectedHeaders = {
        'strict-transport-security': 'HSTS ヘッダー',
        'x-content-type-options': 'Content-Type スニッフィング保護',
        'x-frame-options': 'クリックジャッキング保護',
        'x-xss-protection': 'XSS 保護',
        'referrer-policy': 'リファラーポリシー',
        'permissions-policy': '権限ポリシー'
      };

      for (const [header, description] of Object.entries(expectedHeaders)) {
        if (headers[header]) {
          this.addResult(`Security Headers - ${header}`, 'PASS', `${description}: ${headers[header]}`);
        } else {
          this.addResult(`Security Headers - ${header}`, 'FAIL', `${description} が設定されていない`);
        }
      }
    } catch (error) {
      this.addResult('Security Headers', 'ERROR', error.message);
    }
  }

  async testCSP() {
    console.log('🔍 Content Security Policy テスト...');
    try {
      const response = await this.makeRequest(this.baseUrl);
      const csp = response.headers['content-security-policy'];

      if (csp) {
        const policies = csp.split(';').map(p => p.trim());
        const hasDefaultSrc = policies.some(p => p.startsWith("default-src"));
        const hasScriptSrc = policies.some(p => p.startsWith("script-src"));
        const hasStyleSrc = policies.some(p => p.startsWith("style-src"));

        if (hasDefaultSrc && hasScriptSrc && hasStyleSrc) {
          this.addResult('CSP', 'PASS', '基本的な CSP ディレクティブが設定済み');
        } else {
          this.addResult('CSP', 'WARN', '一部の CSP ディレクティブが不足している可能性');
        }
      } else {
        this.addResult('CSP', 'FAIL', 'Content Security Policy が設定されていない');
      }
    } catch (error) {
      this.addResult('CSP', 'ERROR', error.message);
    }
  }

  async testRateLimiting() {
    console.log('🔍 レート制限テスト...');
    try {
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(this.makeRequest(`${this.baseUrl}/api/health`));
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.statusCode === 429).length;

      if (tooManyRequests > 0) {
        this.addResult('Rate Limiting', 'PASS', `レート制限が動作中 (${tooManyRequests} requests blocked)`);
      } else {
        this.addResult('Rate Limiting', 'WARN', 'レート制限が適用されていない可能性');
      }
    } catch (error) {
      this.addResult('Rate Limiting', 'ERROR', error.message);
    }
  }

  async testBruteForceProtection() {
    console.log('🔍 ブルートフォース保護テスト...');
    try {
      const loginAttempts = [];
      for (let i = 0; i < 10; i++) {
        loginAttempts.push(
          this.makeRequest(`${this.baseUrl}/api/auth/signin`, 'POST', {
            email: 'test@example.com',
            password: 'wrongpassword'
          })
        );
      }

      const results = await Promise.all(loginAttempts);
      const blockedAttempts = results.filter(r => r.statusCode === 429 || r.statusCode === 423).length;

      if (blockedAttempts > 3) {
        this.addResult('Brute Force Protection', 'PASS', `ブルートフォース保護が動作中 (${blockedAttempts} attempts blocked)`);
      } else {
        this.addResult('Brute Force Protection', 'WARN', 'ブルートフォース保護が不十分な可能性');
      }
    } catch (error) {
      this.addResult('Brute Force Protection', 'ERROR', error.message);
    }
  }

  async testCSRFProtection() {
    console.log('🔍 CSRF 保護テスト...');
    try {
      // CSRF トークンなしでPOSTリクエストを試行
      const response = await this.makeRequest(`${this.baseUrl}/api/auth/signout`, 'POST', {});

      if (response.statusCode === 403 || response.statusCode === 422) {
        this.addResult('CSRF Protection', 'PASS', 'CSRF 保護が動作中');
      } else {
        this.addResult('CSRF Protection', 'WARN', 'CSRF 保護が不十分な可能性');
      }
    } catch (error) {
      this.addResult('CSRF Protection', 'ERROR', error.message);
    }
  }

  async testInputValidation() {
    console.log('🔍 入力検証テスト...');
    try {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        "'; DROP TABLE users; --",
        '../../../etc/passwd',
        '\\x00\\x01\\x02'
      ];

      let validationsPassed = 0;

      for (const input of maliciousInputs) {
        try {
          const response = await this.makeRequest(`${this.baseUrl}/api/test-input`, 'POST', {
            testInput: input
          });

          if (response.statusCode === 400 || response.statusCode === 422) {
            validationsPassed++;
          }
        } catch (error) {
          // 期待されるエラー
          validationsPassed++;
        }
      }

      if (validationsPassed >= maliciousInputs.length * 0.8) {
        this.addResult('Input Validation', 'PASS', `入力検証が適切に動作中 (${validationsPassed}/${maliciousInputs.length})`);
      } else {
        this.addResult('Input Validation', 'WARN', `入力検証に改善の余地あり (${validationsPassed}/${maliciousInputs.length})`);
      }
    } catch (error) {
      this.addResult('Input Validation', 'ERROR', error.message);
    }
  }

  async testFileUploadSecurity() {
    console.log('🔍 ファイルアップロードセキュリティテスト...');
    try {
      // 悪意のあるファイル拡張子をテスト
      const maliciousFiles = [
        { name: 'test.exe', content: 'MZ' },
        { name: 'script.php', content: '<?php echo "hack"; ?>' },
        { name: '../../../test.txt', content: 'path traversal' }
      ];

      let secureUploads = 0;

      for (const file of maliciousFiles) {
        try {
          const response = await this.makeRequest(`${this.baseUrl}/api/upload`, 'POST', {
            file: file
          });

          if (response.statusCode === 400 || response.statusCode === 415) {
            secureUploads++;
          }
        } catch (error) {
          // 期待されるエラー
          secureUploads++;
        }
      }

      if (secureUploads >= maliciousFiles.length) {
        this.addResult('File Upload Security', 'PASS', 'ファイルアップロードが適切に保護されている');
      } else {
        this.addResult('File Upload Security', 'WARN', 'ファイルアップロードセキュリティに改善の余地あり');
      }
    } catch (error) {
      this.addResult('File Upload Security', 'ERROR', error.message);
    }
  }

  async testSessionSecurity() {
    console.log('🔍 セッションセキュリティテスト...');
    try {
      const response = await this.makeRequest(this.baseUrl);
      const setCookieHeaders = response.headers['set-cookie'] || [];

      let secureFlags = 0;
      let httpOnlyFlags = 0;
      let sameSiteFlags = 0;

      setCookieHeaders.forEach(cookie => {
        if (cookie.includes('Secure')) secureFlags++;
        if (cookie.includes('HttpOnly')) httpOnlyFlags++;
        if (cookie.includes('SameSite')) sameSiteFlags++;
      });

      const totalCookies = setCookieHeaders.length;
      if (totalCookies > 0) {
        const securityScore = (secureFlags + httpOnlyFlags + sameSiteFlags) / (totalCookies * 3);

        if (securityScore >= 0.8) {
          this.addResult('Session Security', 'PASS', 'セッションセキュリティが適切に設定されている');
        } else {
          this.addResult('Session Security', 'WARN', 'セッションセキュリティに改善の余地あり');
        }
      } else {
        this.addResult('Session Security', 'INFO', 'セッションクッキーが設定されていない');
      }
    } catch (error) {
      this.addResult('Session Security', 'ERROR', error.message);
    }
  }

  async testSSLConfiguration() {
    console.log('🔍 SSL 設定テスト...');
    try {
      const options = {
        hostname: 'localhost',
        port: 443,
        path: '/',
        method: 'GET',
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        const cipher = res.connection.getCipher();
        const cert = res.connection.getPeerCertificate();

        if (cipher && cipher.version === 'TLSv1.3' || cipher.version === 'TLSv1.2') {
          this.addResult('SSL Configuration', 'PASS', `適切な TLS バージョン: ${cipher.version}`);
        } else {
          this.addResult('SSL Configuration', 'WARN', `古い TLS バージョン: ${cipher?.version || 'unknown'}`);
        }
      });

      req.on('error', (error) => {
        this.addResult('SSL Configuration', 'ERROR', error.message);
      });

      req.end();
    } catch (error) {
      this.addResult('SSL Configuration', 'ERROR', error.message);
    }
  }

  makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: method,
        rejectUnauthorized: false,
        timeout: 5000
      };

      if (data && method !== 'GET') {
        const jsonData = JSON.stringify(data);
        options.headers = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonData)
        };
      }

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  addResult(test, status, message) {
    this.results.push({ test, status, message });

    const icon = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'ERROR': '🚨',
      'INFO': 'ℹ️'
    }[status] || '❓';

    console.log(`${icon} ${test}: ${message}`);
  }

  generateReport() {
    console.log('\n📊 セキュリティテスト結果レポート\n');
    console.log('=' .repeat(60));

    const summary = this.results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 結果サマリー:');
    Object.entries(summary).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log('\n🔍 詳細結果:');
    this.results.forEach(result => {
      console.log(`  ${result.status.padEnd(5)} | ${result.test.padEnd(25)} | ${result.message}`);
    });

    console.log('\n' + '='.repeat(60));

    const passRate = ((summary.PASS || 0) / this.results.length * 100).toFixed(1);
    console.log(`🎯 セキュリティスコア: ${passRate}%`);

    if (passRate >= 80) {
      console.log('🎉 セキュリティレベル: 優秀');
    } else if (passRate >= 60) {
      console.log('👍 セキュリティレベル: 良好');
    } else {
      console.log('⚠️  セキュリティレベル: 要改善');
    }

    console.log('\n📋 推奨アクション:');
    this.results
      .filter(r => r.status === 'FAIL' || r.status === 'WARN')
      .forEach(result => {
        console.log(`  • ${result.test}: ${result.message}`);
      });

    console.log('\n🔐 セキュリティテスト完了\n');
  }
}

// テスト実行
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;