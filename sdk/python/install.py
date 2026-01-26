#!/usr/bin/env python3
"""
Planck SDK Remote Installer
============================

Installs the Planck SDK from PyPI or directly from GitHub.

Recommended Installation:
    pip install planck_sdk

Alternative (from GitHub):
    pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python

After installation:
    from planck_sdk import PlanckClient
    client = PlanckClient(api_key="your_api_key")
"""

import os
import sys
import subprocess

__version__ = "1.0.0"


def install_from_pypi():
    """Install SDK from PyPI (recommended)."""
    print("Installing Planck SDK from PyPI...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "planck_sdk", "-q"])
        print("Planck SDK installed successfully!")
        return True
    except subprocess.CalledProcessError:
        print("Failed to install from PyPI, trying GitHub...")
        return False


def install_from_github():
    """Install SDK directly from GitHub."""
    print("Installing Planck SDK from GitHub...")
    url = "git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python"
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", url, "-q"])
        print("Planck SDK installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Installation failed: {e}")
        return False


def verify_installation():
    """Verify that the SDK is installed correctly."""
    try:
        import planck_sdk
        print(f"\nPlanck SDK v{planck_sdk.__version__} installed successfully!")
        print("\nQuick Start:")
        print("  from planck_sdk import PlanckClient")
        print("  client = PlanckClient(api_key='your_api_key')")
        print("  result = client.run(data=[1,2,3,4], algorithm='vqe')")
        print("\nGet your API key at: https://planck.plancktechnologies.xyz/qsaas/settings")
        return True
    except ImportError:
        print("Installation verification failed. Please try again.")
        return False


def main():
    """Main installation function."""
    print(f"\nPlanck SDK Installer v{__version__}")
    print("=" * 50)
    
    # Try PyPI first, then GitHub
    if not install_from_pypi():
        if not install_from_github():
            print("\nInstallation failed. Please try manually:")
            print("  pip install planck_sdk")
            sys.exit(1)
    
    verify_installation()


if __name__ == "__main__":
    main()
