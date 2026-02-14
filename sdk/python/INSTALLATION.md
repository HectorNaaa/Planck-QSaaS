# Planck SDK Installation Guide

This guide covers different ways to install and use the Planck Python SDK.  
**Zero dependencies** - the SDK uses only Python standard library.

---

## Method 1: pip install from PyPI (Recommended)

The easiest and recommended method:

```bash
pip install planck_sdk
```

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Verify installation
```bash
python -c "import planck_sdk; print(f'Planck SDK v{planck_sdk.__version__}')"
```

---

## Method 2: Jupyter / Google Colab Setup

### Install in notebook cell
```python
!pip install -q planck_sdk
print("Planck SDK installed!")
```

### Quick start in notebook
```python
from planck_sdk import PlanckClient

client = PlanckClient(
    api_key="your_api_key",
    base_url="https://plancktechnologies.xyz"
)

# Check connection
health = client.health_check()
print(f"API Status: {health.get('status')}")

# Run a circuit
result = client.run(data=[1, 2, 3, 4], algorithm="bell_state")
print(f"Counts: {result.counts}")
```

---

## Method 3: Install from Source (Development)

### Prerequisites
- Python 3.8 or higher
- pip package manager
- git

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
   
   This installs the package in "editable" mode for development.

3. **Verify installation**:
   ```bash
   python -c "from planck_sdk import PlanckClient; print('Planck SDK installed')"
   ```

---

## Method 4: Build and Install as Wheel

1. **Install build tools**:
   ```bash
   pip install build
   ```

2. **Build the package**:
   ```bash
   cd Planck-QSaaS/sdk/python
   python -m build
   ```

3. **Install the wheel**:
   ```bash
   pip install dist/planck_sdk-1.0.0-py3-none-any.whl
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
pip install planck_sdk

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
pip install planck_sdk

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
   pip uninstall planck_sdk
   pip install planck_sdk
   ```

### Permission Errors

If you get permission errors during installation:

```bash
# Install for current user only
pip install --user planck_sdk
```

### Dependencies Issues

The SDK has zero external dependencies and uses only Python standard library. If you encounter issues:

```bash
# Upgrade pip
pip install --upgrade pip

# Clean install
pip cache purge
pip install planck_sdk --no-cache-dir
```

## Verifying Installation

Create a test script `test_planck.py`:

```python
from planck_sdk import PlanckClient, QuantumCircuit, ExecutionResult
from planck_sdk.exceptions import AuthenticationError, CircuitError, APIError

print("All imports successful")
print(f"SDK Version: {__import__('planck_sdk').__version__}")

# Test client initialization
client = PlanckClient(
    api_key="your_api_key",
    base_url="https://plancktechnologies.xyz"
)

# Check health
try:
    health = client.health_check()
    print(f"API Status: {health.get('status')}")
except Exception as e:
    print(f"Health check failed: {e}")
```

Run it:
```bash
python test_planck.py
```

## Next Steps

1. Get your API key from [https://plancktechnologies.xyz/qsaas/settings](https://plancktechnologies.xyz/qsaas/settings)
2. Set up your environment variable (optional):
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
