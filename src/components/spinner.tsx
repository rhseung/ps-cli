import React from "react";
import { Text } from "ink";
import Spinner from "ink-spinner";

interface SpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "로딩 중..." }: SpinnerProps) {
  return (
    <Text>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>{" "}
      {message}
    </Text>
  );
}
