import json
import tempfile
from pathlib import Path

import pytest

from planck_sdk.client import PlanckUser
from planck_sdk.exceptions import ValidationError, CircuitError


@pytest.fixture
def user():
    return PlanckUser(api_key="sk_valid_key_12345")


class TestValidateInputData:
    def test_none_raises(self, user):
        with pytest.raises(ValidationError, match="cannot be None"):
            user._validate_input_data(None)

    def test_string_passed_through(self, user):
        result, count = user._validate_input_data("/path/to/file.csv")
        assert result == "/path/to/file.csv"
        assert count == 0

    def test_list_under_cap(self, user):
        data = [1, 2, 3, 4, 5]
        result, count = user._validate_input_data(data)
        assert result == [1, 2, 3, 4, 5]
        assert count == 5

    def test_list_over_cap_is_sampled(self, user):
        data = list(range(10_000))
        result, count = user._validate_input_data(data)
        assert count == 10_000
        assert len(result) <= 5_000

    def test_list_over_cap_contains_distinct_elements(self, user):
        data = list(range(10_000))
        result, count = user._validate_input_data(data)
        sampled_set = set(result)
        assert len(sampled_set) > 1

    def test_dict_returned(self, user):
        data = {"key": "value", "numbers": [1, 2, 3]}
        result, count = user._validate_input_data(data)
        assert result == data
        assert count == 1

    def test_dict_too_large_raises(self, user):
        large_value = "x" * (1024 * 1024)
        data = {"big": large_value}
        with pytest.raises(ValidationError, match="too large"):
            user._validate_input_data(data)

    def test_unsupported_type_raises(self, user):
        with pytest.raises(ValidationError, match="Unsupported data type"):
            user._validate_input_data(42)

    def test_unsupported_type_float_raises(self, user):
        with pytest.raises(ValidationError, match="Unsupported data type"):
            user._validate_input_data(3.14)


class TestExtractQubitCount:
    def test_extract_simple(self, user):
        qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\n'
        assert user._extract_qubit_count(qasm) == 3

    def test_extract_different_name(self, user):
        qasm = 'qreg myqubits[5];'
        assert user._extract_qubit_count(qasm) == 5

    def test_no_match_default(self, user):
        qasm = 'OPENQASM 2.0;\nh q[0];'
        assert user._extract_qubit_count(qasm) == 4

    def test_empty_qasm_default(self, user):
        assert user._extract_qubit_count("") == 4


class TestLoadDataFile:
    def test_json_file(self, user):
        data = {"key": "value", "items": [1, 2, 3]}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            path = f.name
        try:
            result, count = user._load_data_file(path)
            assert result == data
            assert count == 1
        finally:
            Path(path).unlink(missing_ok=True)

    def test_json_list_file(self, user):
        data = [{"a": 1}, {"a": 2}]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            path = f.name
        try:
            result, count = user._load_data_file(path)
            assert result == data
            assert count == 2
        finally:
            Path(path).unlink(missing_ok=True)

    def test_csv_file(self, user):
        csv_content = "a,b,c\n1,2,3\n4,5,6\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            path = f.name
        try:
            result, count = user._load_data_file(path)
            assert count == 2
            assert result == [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]
        finally:
            Path(path).unlink(missing_ok=True)

    def test_file_not_found(self, user):
        with pytest.raises(CircuitError, match="File not found"):
            user._load_data_file("/nonexistent/path.json")

    def test_path_traversal_blocked(self, user):
        with pytest.raises(ValidationError, match="Invalid file path"):
            user._load_data_file("../etc/passwd")

    def test_unknown_extension_treated_as_json(self, user):
        data = [1, 2, 3]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".dat", delete=False) as f:
            f.write(json.dumps(data))
            path = f.name
        try:
            result, count = user._load_data_file(path)
            assert result == [1, 2, 3]
            assert count == 3
        finally:
            Path(path).unlink(missing_ok=True)

    def test_unknown_extension_fallback_lines(self, user):
        content = "line1\nline2\nline3\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".dat", delete=False) as f:
            f.write(content)
            path = f.name
        try:
            result, count = user._load_data_file(path)
            assert result == ["line1", "line2", "line3"]
            assert count == 3
        finally:
            Path(path).unlink(missing_ok=True)

    def test_csv_large_file_sampling(self, user):
        lines = ["x,y,z"] + [f"{i},{i+1},{i+2}" for i in range(10_000)]
        content = "\n".join(lines)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(content)
            path = f.name
        try:
            result, count = user._load_data_file(path)
            assert count == 10_000
            assert len(result) <= 5_000
        finally:
            Path(path).unlink(missing_ok=True)
