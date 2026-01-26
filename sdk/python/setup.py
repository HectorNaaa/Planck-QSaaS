"""
Planck SDK - Setup configuration for PyPI/GitHub distribution
Lightweight installation with zero external dependencies.

Install with: pip install planck_sdk
"""

from setuptools import setup

# Read README for long description (optional, fallback if not available)
try:
    with open("README.md", "r", encoding="utf-8") as f:
        long_description = f.read()
except FileNotFoundError:
    long_description = "Planck Quantum SDK - Python client for quantum circuit simulation"

setup(
    name="planck_sdk",
    version="1.0.0",
    author="Planck Technologies",
    author_email="hello@plancktechnologies.xyz",
    description="Lightweight Python SDK for Planck Quantum Digital Twins Platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/HectorNaaa/Planck-QSaaS",
    project_urls={
        "Documentation": "https://github.com/HectorNaaa/Planck-QSaaS/tree/main/sdk/python",
        "Bug Tracker": "https://github.com/HectorNaaa/Planck-QSaaS/issues",
        "Platform": "https://planck.plancktechnologies.xyz",
    },
    packages=["planck_sdk"],
    package_dir={"": "."},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Physics",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=[],  # Zero dependencies - uses Python stdlib only
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    keywords=[
        "quantum",
        "quantum-computing", 
        "digital-twins",
        "simulation",
        "qasm",
        "planck",
    ],
    zip_safe=True,
)
