"""Quantum gate definitions and commutation rules."""

import enum


class GateType(enum.Enum):
    """Supported gate types for the Clifford+T optimization pass."""

    H = "H"
    X = "X"
    Y = "Y"
    Z = "Z"
    S = "S"
    T = "T"
    CNOT = "CNOT"
    RZ = "RZ"
    RX = "RX"
    RY = "RY"
    CU1 = "CU1"
    SWAP = "SWAP"


class Gate:
    """Represents a single quantum gate operation in a circuit.

    Attributes:
        gate_type: The type of the quantum gate.
        target_qubits: Qubits that the gate acts on directly.
        control_qubits: Qubits that control the gate operation.
        all_qubits: The set of all qubits involved in this gate (both target
            and control qubits).
    """

    __slots__ = (
        "_gate_type",
        "_target_qubits",
        "_control_qubits",
        "_all_qubits",
        "_angle",
    )

    _PARAMETRIC_TYPES: frozenset[GateType] = frozenset(
        {GateType.RZ, GateType.RX, GateType.RY, GateType.CU1}
    )

    def __init__(
        self,
        _gate_type: GateType,
        target_qubits: tuple[int, ...],
        control_qubits: tuple[int, ...] | None = None,
        angle: float | None = None,
    ):
        """Initializes a quantum gate.

        Args:
            _gate_type: The type of the gate.
            target_qubits: Qubits that the gate acts on directly.
            control_qubits: Qubits that control the gate operation.
                Defaults to None.
            angle: The rotation angle in radians for parametric gates
                (RZ, RX, RY). Required for parametric types, must be
                None for non-parametric types.

        Raises:
            ValueError: If no target qubits are provided.
            ValueError: If there are overlapping qubits between target and
                control qubits.
            ValueError: If angle is provided for a non-parametric gate, or
                if angle is missing for a parametric gate.
        """
        if not target_qubits:
            raise ValueError("Gate must have at least one target qubit.")

        # TODO: Validate that parametric gate types (RZ, RX, RY) receive an angle,
        # and that non-parametric gate types do NOT receive an angle.
        # Raise ValueError with a descriptive message in each invalid case.

        self._gate_type: GateType = _gate_type
        self._target_qubits: tuple[int, ...] = tuple(target_qubits)
        self._control_qubits: tuple[int, ...] = (
            tuple(control_qubits) if control_qubits else ()
        )
        self._angle: float | None = angle
        # Make all qubits a frozenset so that new qubits can be added to the
        # set without mutating the original set.
        self._all_qubits: frozenset[int] = frozenset(self._target_qubits).union(
            self._control_qubits
        )

        # Verify no qubit is used as both a target and a control simultaneously
        if len(self._all_qubits) != (
            len(self._target_qubits) + len(self._control_qubits)
        ):
            raise ValueError(
                f"Overlapping qubits found in target {self._target_qubits} "
                f"and control {self._control_qubits}"
            )

    @property
    def angle(self) -> float | None:
        """Gets the rotation angle for parametric gates.

        Returns:
            The angle in radians, or None for non-parametric gates.
        """
        return self._angle

    @property
    def is_self_inverse(self) -> bool:
        """Checks if the gate is self-inverse.

        Returns:
            True if applying this gate twice results in the identity operation,
            False otherwise.
        """
        # H, X, Y, Z, and CNOT are self-inverse. S and T are not (S^2 = Z, T^2 = S).
        # Parametric rotation gates (RZ, RX, RY) are NOT self-inverse in general.
        return self._gate_type in {
            GateType.H,
            GateType.X,
            GateType.Y,
            GateType.Z,
            GateType.CNOT,
            GateType.SWAP,
        }

    @property
    def is_identity(self) -> bool:
        """Checks if this gate evaluates to the identity operation.

        A parametric rotation gate is identity when its angle is 0 mod 2π
        (within floating-point tolerance of 1e-10).
        Non-parametric gates are never identity.

        Returns:
            True if this gate is effectively a no-op.
        """
        if self._gate_type not in self._PARAMETRIC_TYPES:
            return False
        if self._angle is None:
            return False
        import math

        remainder = self._angle % (2 * math.pi)
        return min(remainder, 2 * math.pi - remainder) < 1e-10

    @property
    def inverse(self) -> "Gate":
        """Returns the inverse of this gate.

        For self-inverse gates (H, X, Y, Z, CNOT), returns a copy of the same gate.
        For S, returns RZ(-π/2). For T, returns RZ(-π/4).
        For parametric gates RZ(θ)/RX(θ)/RY(θ), returns the same type with -θ.

        Returns:
            A new Gate that is the inverse of this gate.

        Raises:
            NotImplementedError: If inverse is not defined for this gate type.
        """
        if self.is_self_inverse:
            return Gate(
                self._gate_type,
                self.target_qubits,
                control_qubits=self.control_qubits,
                angle=self._angle,
            )
        import math

        if self._gate_type == GateType.S:
            return Gate(GateType.RZ, self.target_qubits, angle=-math.pi / 2)
        if self._gate_type == GateType.T:
            return Gate(GateType.RZ, self.target_qubits, angle=-math.pi / 4)
        if self._gate_type in self._PARAMETRIC_TYPES:
            if self._gate_type == GateType.CU1:
                return Gate(
                    self._gate_type,
                    self.target_qubits,
                    control_qubits=self.control_qubits,
                    angle=-self._angle if self._angle is not None else 0.0,
                )
            else:
                return Gate(
                    self._gate_type,
                    self.target_qubits,
                    angle=-self._angle if self._angle is not None else 0.0,
                )
        raise NotImplementedError(f"Inverse not implemented for {self._gate_type}")

    def merge_with(self, other: "Gate") -> "Gate | None":
        """Attempts to merge this gate with another same-axis rotation gate.

        Both gates must act on the same qubit(s) and be on the same rotation axis.
        Z-axis family: Z, S, T, RZ.
        X-axis family: X, RX.
        Y-axis family: Y, RY.

        Args:
            other: The other gate to merge with.

        Returns:
            A new merged Gate, or None if the merged result is identity (angle ≈ 0 mod 2π).

        Raises:
            ValueError: If the gates cannot be merged (different axes or qubits).
        """
        if (
            self.target_qubits != other.target_qubits
            or self.control_qubits != other.control_qubits
        ):
            raise ValueError("Cannot merge gates acting on different qubits")

        import math

        z_family = {GateType.Z, GateType.S, GateType.T, GateType.RZ}
        x_family = {GateType.X, GateType.RX}
        y_family = {GateType.Y, GateType.RY}

        def get_angle_and_axis(g: "Gate") -> tuple[float, str]:
            t = g._gate_type
            if t in z_family:
                if t == GateType.Z:
                    return math.pi, "Z"
                if t == GateType.S:
                    return math.pi / 2, "Z"
                if t == GateType.T:
                    return math.pi / 4, "Z"
                return g.angle if g.angle is not None else 0.0, "Z"
            if t in x_family:
                if t == GateType.X:
                    return math.pi, "X"
                return g.angle if g.angle is not None else 0.0, "X"
            if t in y_family:
                if t == GateType.Y:
                    return math.pi, "Y"
                return g.angle if g.angle is not None else 0.0, "Y"
            raise ValueError(f"Cannot determine axis for gate type {t}")

        try:
            angle1, axis1 = get_angle_and_axis(self)
            angle2, axis2 = get_angle_and_axis(other)
        except ValueError as e:
            raise ValueError(f"Cannot merge: {e}") from e

        if axis1 != axis2:
            raise ValueError(
                f"Cannot merge gates on different axes: {axis1} and {axis2}"
            )

        summed_angle = angle1 + angle2
        remainder = summed_angle % (2 * math.pi)
        if min(remainder, 2 * math.pi - remainder) < 1e-10:
            return None

        merged_type = (
            GateType.RZ
            if axis1 == "Z"
            else (GateType.RX if axis1 == "X" else GateType.RY)
        )
        if self.control_qubits:
            return Gate(
                merged_type,
                self.target_qubits,
                control_qubits=self.control_qubits,
                angle=summed_angle,
            )
        else:
            return Gate(merged_type, self.target_qubits, angle=summed_angle)

    @property
    def gate_type(self) -> GateType:
        """Gets the type of the gate.

        Returns:
            The GateType.
        """
        return self._gate_type

    @property
    def target_qubits(self) -> tuple[int, ...]:
        """Gets the target qubits of the gate.

        Returns:
            A tuple of target qubit indices.
        """
        return self._target_qubits

    @property
    def control_qubits(self) -> tuple[int, ...]:
        """Gets the control qubits of the gate.

        Returns:
            A tuple of control qubit indices.
        """
        return self._control_qubits

    @property
    def all_qubits(self) -> frozenset[int]:
        """Gets all qubits involved in the gate.

        Returns:
            A frozenset containing all target and control qubit indices.
        """
        return self._all_qubits

    def commutes_with(self, other: "Gate") -> bool:
        """Determines if this gate commutes with another gate.

        Args:
            other: The other quantum gate.

        Returns:
            True if the gates commute, False otherwise.
        """
        # If they don't share any qubits, they always commute
        if not self.all_qubits.intersection(other.all_qubits):
            return True

        # Rule 1: Identical single-qubit Pauli/Clifford gates on the same qubit commute
        if self._gate_type == other._gate_type and len(self.all_qubits) == 1:
            return True

        # Rule 2: Z-basis gates (Z, S, T, RZ) commute with each other on the same qubit
        z_basis: set[GateType] = {GateType.Z, GateType.S, GateType.T, GateType.RZ}
        if self._gate_type in z_basis and other._gate_type in z_basis:
            return True

        # TODO: Add commutation rules for RX and RY:
        # - RX commutes with X on the same qubit (same axis).
        # - RY commutes with Y on the same qubit (same axis).
        # - RX commutes with other RX gates on the same qubit.
        # - RY commutes with other RY gates on the same qubit.

        # Helper function to check asymmetric commutation rules
        def commutes_asymmetric(g1: "Gate", g2: "Gate") -> bool:
            if g2._gate_type == GateType.CNOT:
                # Rule 3: X/RX gate commutes with the TARGET line of a CNOT gate
                if (
                    g1._gate_type in {GateType.X, GateType.RX}
                    and g1.target_qubits[0] in g2.target_qubits
                ):
                    return True
                # Rule 4: Z-basis gates commute with the CONTROL line of a CNOT gate
                if (
                    g1._gate_type in z_basis
                    and g1.target_qubits[0] in g2.control_qubits
                ):
                    return True
            return False

        if commutes_asymmetric(self, other) or commutes_asymmetric(other, self):
            return True

        return False

    def __eq__(self, other: object) -> bool:
        """Checks equality between this gate and another object.

        Args:
            other: The object to compare with.

        Returns:
            True if other is a Gate with the same type, target, control
            qubits, and angle; False otherwise.
        """
        if not isinstance(other, Gate):
            return False
        return (
            self._gate_type == other._gate_type
            and self.target_qubits == other.target_qubits
            and self.control_qubits == other.control_qubits
            and self._angle == other._angle
        )

    def __repr__(self) -> str:
        """Gets a string representation of the gate.

        Returns:
            A string representation of the gate.
        """
        controls: str = (
            f", ctrl={list(self.control_qubits)}" if self.control_qubits else ""
        )
        angle_str: str = f", angle={self._angle}" if self._angle is not None else ""
        return (
            f"Gate({self._gate_type.value},"
            f" targets={list(self.target_qubits)}"
            f"{controls}"
            f"{angle_str})"
        )

    def __hash__(self) -> int:
        """Gets the hash value of the gate.

        Returns:
            An integer hash computed from gate_type, target_qubits,
            control_qubits, and angle.
        """
        return hash(
            (self._gate_type, self.target_qubits, self.control_qubits, self._angle)
        )
