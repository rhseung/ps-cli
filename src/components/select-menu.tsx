import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectMenuProps {
  items: SelectOption[];
  onSelect: (item: SelectOption) => void;
  message?: string;
}

export function SelectMenu({
  items,
  onSelect,
  message = "선택하세요:",
}: SelectMenuProps) {
  return (
    <Box flexDirection="column">
      <Text>{message}</Text>
      <SelectInput items={items} onSelect={onSelect} />
    </Box>
  );
}
