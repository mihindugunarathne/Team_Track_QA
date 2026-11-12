"use client";

import BugReportIcon from "@mui/icons-material/BugReport";
import CodeIcon from "@mui/icons-material/Code";
import LanguageIcon from "@mui/icons-material/Language";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import {
  FormControl,
  InputLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { TASK_TYPE_VALUES, type TaskTypeValue } from "@/lib/taskTypes";

function TaskTypeIcon({ type }: { type: TaskTypeValue }) {
  const sx = { fontSize: 20, color: "var(--foreground)" };
  switch (type) {
    case "Bug":
      return <BugReportIcon sx={sx} />;
    case "Development":
      return <CodeIcon sx={sx} />;
    case "Web":
      return <LanguageIcon sx={sx} />;
    case "Mobile":
      return <PhoneIphoneIcon sx={sx} />;
    default:
      return null;
  }
}

type Props = {
  id?: string;
  labelId?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

/**
 * MUI select so each option can show a Material icon (native &lt;select&gt; cannot).
 */
export function TaskTypeSelectField({
  id = "task-type",
  labelId = "task-type-label",
  value,
  onChange,
  disabled = false,
  required = false,
}: Props) {
  function handleChange(event: SelectChangeEvent<string>) {
    onChange(event.target.value);
  }

  return (
    <FormControl fullWidth required={required} disabled={disabled}>
      <InputLabel id={labelId} shrink>
        Task type *
      </InputLabel>
      <Select
        id={id}
        labelId={labelId}
        label="Task type *"
        displayEmpty
        value={value}
        onChange={handleChange}
        renderValue={(selected) => {
          if (!selected) {
            return (
              <span style={{ color: "var(--text-muted)" }}>Select task type</span>
            );
          }
          return (
            <span className="flex items-center gap-2">
              <TaskTypeIcon type={selected as TaskTypeValue} />
              <span>{selected}</span>
            </span>
          );
        }}
        sx={{
          borderRadius: "12px",
          backgroundColor: "var(--surface)",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--border)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--border)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--primary)",
            borderWidth: 1,
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              borderRadius: "12px",
              mt: 0.5,
              border: "1px solid var(--border)",
            },
          },
        }}
      >
        <MenuItem value="">
          <em>Select task type</em>
        </MenuItem>
        {TASK_TYPE_VALUES.map((type) => (
          <MenuItem key={type} value={type}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <TaskTypeIcon type={type} />
            </ListItemIcon>
            <ListItemText primary={type} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
