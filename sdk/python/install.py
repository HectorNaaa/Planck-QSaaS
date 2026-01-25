#!/usr/bin/env python3
"""
Planck SDK Remote Installer
============================

Installs the Planck SDK directly from GitHub without requiring git.
Downloads only the essential SDK files using raw GitHub URLs.

Usage:
    # Method 1: Run directly with Python (no pip needed for installation script)
    python -c "import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/HectorNaaa/Planck-QSaaS/main/sdk/python/install.py').read())"
    
    # Method 2: Download and run
    curl -sSL https://raw.githubusercontent.com/HectorNaaa/Planck-QSaaS/main/sdk/python/install.py | python3
    
    # Method 3: pip install from GitHub (requires pip but not git)
    pip install https://github.com/HectorNaaa/Planck-QSaaS/archive/refs/heads/main.zip#subdirectory=sdk/python

After installation:
    from planck_sdk import PlanckClient
    client = PlanckClient(api_key="your_api_key")
"""

import os
import sys
import tempfile
import shutil
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

__version__ = "0.9.1"

# GitHub raw content base URL
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/HectorNaaa/Planck-QSaaS/main/sdk/python"

# Core SDK files to download (minimal footprint)
SDK_FILES = [
    "planck_sdk/__init__.py",
    "planck_sdk/client.py",
    "planck_sdk/circuit.py",
    "planck_sdk/result.py",
    "planck_sdk/exceptions.py",
]

# Metadata files (optional, for full installation)
METADATA_FILES = [
    "setup.py",
    "pyproject.toml",
]


def download_file(url: str, dest_path: str, verbose: bool = True) -> bool:
    """Download a single file from URL to destination path."""
    try:
        headers = {"User-Agent": "Planck-SDK-Installer/0.9.1"}
        req = Request(url, headers=headers)
        
        with urlopen(req, timeout=30) as response:
            content = response.read()
        
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(content)
        
        if verbose:
            print(f"  [OK] {os.path.basename(dest_path)}")
        return True
        
    except (HTTPError, URLError) as e:
        if verbose:
            print(f"  [FAIL] {os.path.basename(dest_path)}: {e}")
        return False


def get_site_packages() -> str:
    """Get the user's site-packages directory."""
    try:
        import site
        # Try user site-packages first
        user_site = site.getusersitepackages()
        if user_site:
            return user_site
    except Exception:
        pass
    
    # Fallback to system site-packages
    for path in sys.path:
        if "site-packages" in path:
            return path
    
    # Last resort: create in user home
    return os.path.join(os.path.expanduser("~"), ".local", "lib", f"python{sys.version_info.major}.{sys.version_info.minor}", "site-packages")


def install_minimal(dest_dir: str = None, verbose: bool = True) -> bool:
    """
    Install only the core SDK files (minimal footprint).
    
    Args:
        dest_dir: Destination directory (defaults to site-packages)
        verbose: Print progress messages
    
    Returns:
        True if installation successful
    """
    if dest_dir is None:
        dest_dir = get_site_packages()
    
    sdk_dir = os.path.join(dest_dir, "planck_sdk")
    
    if verbose:
        print(f"\nPlanck SDK v{__version__} - Minimal Installation")
        print("=" * 50)
        print(f"Installing to: {sdk_dir}")
        print("\nDownloading core files...")
    
    # Create package directory
    os.makedirs(sdk_dir, exist_ok=True)
    
    success = True
    for file_path in SDK_FILES:
        url = f"{GITHUB_RAW_BASE}/{file_path}"
        dest = os.path.join(dest_dir, file_path)
        if not download_file(url, dest, verbose):
            success = False
    
    if success and verbose:
        print("\n" + "=" * 50)
        print("Installation complete!")
        print("\nQuick Start:")
        print("  from planck_sdk import PlanckClient")
        print("  client = PlanckClient(api_key='your_api_key')")
        print("  result = client.run(data=[1,2,3,4], algorithm='vqe')")
        print("\nGet your API key at: https://planck.plancktechnologies.xyz/qsaas/settings")
    
    return success


def install_full(dest_dir: str = None, verbose: bool = True) -> bool:
    """
    Install SDK with metadata files for proper pip integration.
    
    Args:
        dest_dir: Destination directory (defaults to temp for pip)
        verbose: Print progress messages
    """
    if dest_dir is None:
        dest_dir = tempfile.mkdtemp(prefix="planck_sdk_")
    
    if verbose:
        print(f"\nPlanck SDK v{__version__} - Full Installation")
        print("=" * 50)
        print(f"Staging to: {dest_dir}")
    
    # Download all files
    all_files = SDK_FILES + METADATA_FILES
    
    if verbose:
        print("\nDownloading SDK files...")
    
    success = True
    for file_path in all_files:
        url = f"{GITHUB_RAW_BASE}/{file_path}"
        dest = os.path.join(dest_dir, file_path)
        if not download_file(url, dest, verbose):
            success = False
    
    if not success:
        if verbose:
            print("\nSome files failed to download. Installation incomplete.")
        return False
    
    # Create minimal README if not present
    readme_path = os.path.join(dest_dir, "README.md")
    if not os.path.exists(readme_path):
        with open(readme_path, "w") as f:
            f.write("# Planck SDK\n\nPython SDK for Planck Quantum Digital Twins Platform.\n")
    
    # Run pip install on the staged directory
    if verbose:
        print("\nInstalling package with pip...")
    
    import subprocess
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", dest_dir, "--quiet"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            if verbose:
                print(f"pip install failed: {result.stderr}")
            return False
    except Exception as e:
        if verbose:
            print(f"pip install failed: {e}")
        return False
    finally:
        # Cleanup temp directory
        if dest_dir.startswith(tempfile.gettempdir()):
            shutil.rmtree(dest_dir, ignore_errors=True)
    
    if verbose:
        print("\n" + "=" * 50)
        print("Installation complete!")
        print("\nVerify with: python -c \"import planck_sdk; print(planck_sdk.__version__)\"")
    
    return True


def uninstall(verbose: bool = True) -> bool:
    """Uninstall the Planck SDK."""
    import subprocess
    
    if verbose:
        print("\nUninstalling Planck SDK...")
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "uninstall", "planck-sdk", "-y"],
            capture_output=True,
            text=True
        )
        if verbose:
            if result.returncode == 0:
                print("Successfully uninstalled planck-sdk")
            else:
                print(f"Uninstall result: {result.stdout or result.stderr}")
        return result.returncode == 0
    except Exception as e:
        if verbose:
            print(f"Uninstall failed: {e}")
        return False


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Planck SDK Installer - Install directly from GitHub",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python install.py                    # Full installation with pip
  python install.py --minimal          # Download core files only
  python install.py --dest ./my_sdk    # Install to custom directory
  python install.py --uninstall        # Remove the SDK
        """
    )
    parser.add_argument(
        "--minimal", "-m",
        action="store_true",
        help="Install only core SDK files (no pip metadata)"
    )
    parser.add_argument(
        "--dest", "-d",
        type=str,
        default=None,
        help="Custom installation directory"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress output"
    )
    parser.add_argument(
        "--uninstall", "-u",
        action="store_true",
        help="Uninstall the SDK"
    )
    parser.add_argument(
        "--version", "-v",
        action="version",
        version=f"planck-sdk-installer {__version__}"
    )
    
    args = parser.parse_args()
    verbose = not args.quiet
    
    if args.uninstall:
        success = uninstall(verbose)
    elif args.minimal:
        success = install_minimal(args.dest, verbose)
    else:
        success = install_full(args.dest, verbose)
    
    sys.exit(0 if success else 1)


# Auto-install when executed directly or via exec()
if __name__ == "__main__":
    # If no arguments, do minimal install for exec() usage
    if len(sys.argv) == 1 and not sys.stdin.isatty():
        # Running via exec() from urllib - do minimal install
        install_minimal()
    else:
        main()
