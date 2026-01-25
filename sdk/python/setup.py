"""
Planck SDK - Setup configuration for PyPI distribution
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="planck-sdk",
    version="0.9.0",
    author="Planck Technologies",
    author_email="hello@plancktechnologies.xyz",
    description="Python SDK for Planck Quantum Digital Twins Platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/HectorNaaa/Planck-QSaaS",
    project_urls={
        "Documentation": "https://github.com/HectorNaaa/Planck-QSaaS/tree/main/sdk/python",
        "Bug Tracker": "https://github.com/HectorNaaa/Planck-QSaaS/issues",
        "Platform": "https://planck.plancktechnologies.xyz",
    },
    packages=find_packages(),
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
    install_requires=[],  # No external dependencies - uses stdlib only
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
)
