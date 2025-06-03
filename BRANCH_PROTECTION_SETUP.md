# 🛡️ GitHub Branch Protection Setup Guide

Follow these steps to set up branch protection rules that require all tests to pass before merging PRs.

## 🔧 Setting Up Branch Protection Rules

### 1. Navigate to Repository Settings

1. Go to your repository: https://github.com/Kynlos/cuovare
2. Click **Settings** tab
3. Click **Branches** in the left sidebar

### 2. Add Branch Protection Rule

1. Click **Add rule** button
2. Configure the following settings:

#### Branch Name Pattern
```
main
```

#### Protect Matching Branches
✅ **Require a pull request before merging**
- ✅ Require approvals: `1`
- ✅ Dismiss stale PR approvals when new commits are pushed
- ✅ Require review from code owners
- ✅ Restrict pushes that create files that exceed 100MB

✅ **Require status checks to pass before merging**
- ✅ Require branches to be up to date before merging
- **Required status checks:**
  - `test / Test Suite (18.x)`
  - `test / Test Suite (20.x)`
  - `build / Build Extension`
  - `pr-validation / PR Validation`
  - `dependency-check / Dependency Security Check`
  - `size-check / Bundle Size Check`

✅ **Require conversation resolution before merging**

✅ **Require signed commits**

✅ **Require linear history**

✅ **Include administrators**

#### Additional Settings
- ✅ Allow force pushes: **Everyone** (for emergency fixes only)
- ✅ Allow deletions: **False**

### 3. Create Additional Protection Rules (Optional)

You may also want to protect the `develop` branch with similar rules:

#### Branch Name Pattern
```
develop
```

#### Settings
- Same as main branch, but allow:
  - More experimental changes
  - Less strict review requirements
  - Allow force pushes for development

## 🤖 GitHub Actions Status Checks

The following workflows will automatically run on every PR:

### Main CI Pipeline (`ci.yml`)
- **Test Suite**: Runs on Node.js 18.x and 20.x
- **Build Extension**: Creates VSIX package
- **Security Scan**: Trivy vulnerability scanner
- **Code Quality**: Coverage reports with Codecov

### PR Quality Checks (`pr-checks.yml`)
- **PR Validation**: Commit message validation, formatting checks
- **Dependency Check**: Security audit and outdated dependency check
- **Bundle Size Check**: Ensures extension stays under 50MB

## 📋 Required Status Checks Explanation

### `test / Test Suite (18.x)` & `test / Test Suite (20.x)`
- Runs all unit tests (34 tests) 
- Runs integration tests with VS Code
- Ensures TypeScript compilation
- Validates code linting

### `build / Build Extension`
- Builds production-ready extension
- Creates VSIX package
- Uploads build artifacts

### `pr-validation / PR Validation`
- Validates commit message format
- Checks code formatting
- Ensures test coverage ≥85%
- Validates PR title format

### `dependency-check / Dependency Security Check`
- Runs `pnpm audit` for security vulnerabilities
- Checks for outdated dependencies
- Ensures dependency integrity

### `size-check / Bundle Size Check`
- Ensures extension VSIX stays under 50MB
- Reports bundle size metrics
- Prevents bloated releases

## 🚨 Enforcement Rules

With these settings:

✅ **No direct pushes to main** - All changes must go through PRs
✅ **All tests must pass** - 34 unit tests + integration tests
✅ **Code review required** - At least 1 approval needed
✅ **Security checks pass** - No vulnerabilities allowed
✅ **Quality gates met** - 85%+ test coverage required
✅ **Bundle size limits** - Extension must stay under 50MB

## 🛠️ Developer Workflow

1. **Create feature branch** from main
2. **Make changes** and commit with conventional commit format
3. **Push branch** and create PR
4. **Wait for CI** - All status checks must pass ✅
5. **Request review** - Get approval from maintainer
6. **Merge** - Once approved and all checks pass

## 🔄 Emergency Procedures

In case of critical hotfixes:

1. **Maintainers** can override protection rules if needed
2. **Force push** is allowed for emergency situations
3. **Post-merge** - Create follow-up PR to add tests

## 🎯 Benefits

- ✅ **Quality Assurance** - No broken code in main branch
- ✅ **Security** - Automatic vulnerability scanning
- ✅ **Performance** - Bundle size monitoring
- ✅ **Maintainability** - Required code reviews
- ✅ **Reliability** - Comprehensive test coverage

---

## 📞 Support

If you need help with branch protection setup:
- 📧 Open an issue in the repository
- 💬 Ask in GitHub Discussions
- 🔧 Contact repository maintainers

Your repository is now protected! 🛡️
