# Planck SDK Installation Guide

This guide covers different ways to install and use the Planck Python SDK.

## Method 1: Install from Source (Recommended for Development)

### Prerequisites
- Python 3.8 or higher
- pip package manager
- git (optional, for cloning)

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/HectorNaaa/Planck-QSaaS.git
   cd Planck-QSaaS/sdk/python
   ```

2. **Install in development mode**:
   ```bash
   pip install -e .
   ```
   
   This installs the package in "editable" mode, so any changes you make to the source code are immediately reflected.

3. **Verify installation**:
   ```bash
   python -c "from planck_sdk import PlanckClient; print('✓ Planck SDK installed successfully')"
   ```

## Method 2: Build and Install as Wheel

1. **Install build tools**:
   ```bash
   pip install build
   ```

2. **Build the package**:
   ```bash
   cd Planck-QSaaS/sdk/python
   python -m build
   ```
   
   This creates a `dist/` directory with `.whl` and `.tar.gz` files.

3. **Install the wheel**:
   ```bash
   pip install dist/planck_sdk-0.9.0-py3-none-any.whl
   ```

## Method 3: Direct Install from GitHub

Install directly from the GitHub repository:

```bash
pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
```

## Method 4: Install from PyPI (Future)

Once published to PyPI:

```bash
pip install planck-sdk
```

## Jupyter Notebook Setup

### Install in Jupyter Notebook

```python
# In a Jupyter cell
!pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
```

### Or with local installation

```python
# In a Jupyter cell, from the sdk/python directory
!pip install -e .
```

### Test in Jupyter

```python
from planck_sdk import PlanckClient

client = PlanckClient(api_key="your_api_key")
print("✓ SDK loaded successfully")
```

## Google Colab Setup

In a Google Colab notebook:

```python
# Cell 1: Install
!pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python

# Cell 2: Import and use
from planck_sdk import PlanckClient

client = PlanckClient(api_key="your_api_key")
result = client.run(data=[1, 2, 3], algorithm="bell")
result.plot_histogram()
```

## Virtual Environment Setup (Recommended)

### Using venv

```bash
# Create virtual environment
python -m venv planck_env

# Activate (Linux/Mac)
source planck_env/bin/activate

# Activate (Windows)
planck_env\Scripts\activate

# Install SDK
pip install -e Planck-QSaaS/sdk/python

# Deactivate when done
deactivate
```

### Using conda

```bash
# Create environment
conda create -n planck python=3.10

# Activate
conda activate planck

# Install SDK
pip install -e Planck-QSaaS/sdk/python

# Deactivate
conda deactivate
```

## Troubleshooting

### Import Error

If you get `ModuleNotFoundError: No module named 'planck_sdk'`:

1. Check installation:
   ```bash
   pip list | grep planck
   ```

2. Verify Python path:
   ```python
   import sys
   print(sys.path)
   ```

3. Reinstall:
   ```bash
   pip uninstall planck-sdk
   pip install -e path/to/Planck-QSaaS/sdk/python
   ```

### Permission Errors

If you get permission errors during installation:

```bash
# Install for current user only
pip install --user -e .
```

### Dependencies Issues

The SDK has zero external dependencies and uses only Python standard library. If you encounter issues:

```bash
# Upgrade pip
pip install --upgrade pip

# Clean install
pip cache purge
pip install -e . --no-cache-dir
```

## Verifying Installation

Create a test script `test_planck.py`:

```python
from planck_sdk import PlanckClient, QuantumCircuit, ExecutionResult
from planck_sdk.exceptions import AuthenticationError, CircuitError

print("✓ All imports successful")
print(f"SDK Version: {__import__('planck_sdk').__version__}")

# Test client initialization (will fail without valid API key, but tests import)
try:
    client = PlanckClient(api_key="test_key")
    print("✓ Client initialization successful")
except Exception as e:
    print(f"✗ Client test failed: {e}")
```

Run it:
```bash
python test_planck.py
```

## Next Steps

1. Get your API key from [https://planck.plancktechnologies.xyz/qsaas/settings](https://planck.plancktechnologies.xyz/qsaas/settings)
2. Set up your environment variable:
   ```bash
   export PLANCK_API_KEY="your_api_key"
   ```
3. Run the examples:
   ```bash
   python examples/basic_usage.py
   ```
4. Check out the [README.md](README.md) for usage examples

## Support

If you encounter any issues:
- Check the [README.md](README.md) for usage examples
- Open an issue on GitHub
- Email: hello@plancktechnologies.xyz
