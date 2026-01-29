import React, { useRef, useCallback } from "react";

interface FilePickerOptions {
  accept: string;
  multiple: boolean;
  onFilesSelected: (files: File[]) => void;
}

const useFilePicker = ({
  accept,
  multiple,
  onFilesSelected,
}: FilePickerOptions) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (fileList && fileList.length > 0) {
        const selectedFiles: File[] = Array.from(fileList);
        onFilesSelected(selectedFiles);
      }
      if (event.target) {
        event.target.value = "";
      }
    },
    [onFilesSelected],
  );

  const FileInputElement = () =>
    React.createElement("input", {
      type: "file",
      ref: inputRef,
      accept: accept,
      multiple: multiple,
      style: { display: "none" },
      onClick: (event: React.MouseEvent<HTMLInputElement>) => {
        (event.target as HTMLInputElement).value = "";
      },
      onChange: handleFileChange,
    });

  return { openFilePicker, FileInputElement };
};

export default useFilePicker;
