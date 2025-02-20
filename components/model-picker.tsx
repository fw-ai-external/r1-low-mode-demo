"use client";
import {} from "@radix-ui/react-select";
import type { FC } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const models = [
  {
    name: "Firefunction V2",
    value: "firefunction-v2",
  },
];
export const ModelPicker: FC = () => {
  return (
    <Select defaultValue={models[0]?.value ?? ""}>
      <SelectTrigger className="max-w-[300px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="">
        {models.map((model) => (
          <SelectItem key={model.value} value={model.value}>
            <span className="flex items-center gap-2">
              <span>{model.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
