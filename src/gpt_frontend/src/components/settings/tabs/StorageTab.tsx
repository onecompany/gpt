import React, { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { TransitionPanel } from "@/components/ui/TransitionPanel";
import { ContentTabs } from "@/components/ui/ContentTabs";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
}

interface ChatItem {
  id: string;
  title: string;
  messages: number;
  age: string;
  size: string;
}

const StorageTab: React.FC = () => {
  const [storageTab, setStorageTab] = useState<"files" | "chats">("files");

  // Pure rendering: Use useMemo for stable dummy data generation
  const dummyFiles: FileItem[] = useMemo(
    () => [
      { id: "1", name: "Ebook.pdf", type: "PDF", size: 5.0 },
      { id: "2", name: "Poster.pdf", type: "PDF", size: 4.8 },
      { id: "3", name: "Wallpaper.jpg", type: "Image", size: 4.5 },
      { id: "4", name: "Report.pdf", type: "PDF", size: 4.1 },
      { id: "5", name: "Portrait.jpg", type: "Image", size: 3.9 },
      { id: "6", name: "Presentation.pdf", type: "PDF", size: 3.5 },
      { id: "7", name: "Graphic.png", type: "Image", size: 3.2 },
      { id: "8", name: "Diagram.pdf", type: "PDF", size: 3.0 },
      { id: "9", name: "Screenshot.png", type: "Image", size: 2.9 },
      { id: "10", name: "Invoice.pdf", type: "PDF", size: 2.7 },
      { id: "11", name: "Photo.jpg", type: "Image", size: 2.4 },
      { id: "12", name: "Brochure.pdf", type: "PDF", size: 2.3 },
      { id: "13", name: "Manual.txt", type: "Text", size: 1.4 },
      { id: "14", name: "Document.txt", type: "Text", size: 1.2 },
      { id: "15", name: "Summary.txt", type: "Text", size: 1.1 },
      { id: "16", name: "Icon.png", type: "Image", size: 1.8 },
      { id: "17", name: "Memo.txt", type: "Text", size: 0.9 },
      { id: "18", name: "Readme.txt", type: "Text", size: 0.7 },
      { id: "19", name: "Notes.txt", type: "Text", size: 0.8 },
      { id: "20", name: "Archive.zip", type: "Text", size: 0.5 },
    ],
    [],
  );

  const sortedFiles = useMemo(
    () => [...dummyFiles].sort((a, b) => b.size - a.size),
    [dummyFiles],
  );
  const totalSize = useMemo(
    () => sortedFiles.reduce((acc, file) => acc + file.size, 0),
    [sortedFiles],
  );
  const formattedTotalSize = totalSize.toFixed(2);

  const dummyChats: ChatItem[] = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: (i + 1).toString(),
        title: `Chat ${i + 1} with an exceptionally long title that might be truncated`,
        messages: Math.floor((i * 1234567) % 100), // Deterministic pseudo-random
        age: `${Math.floor((i * 9876543) % 10) + 1}d`,
        size: ((i * 123) % 30).toFixed(1),
      })),
    [],
  );

  return (
    <div className="flex flex-col w-full h-full">
      <ContentTabs
        activeTab={storageTab}
        onTabChange={setStorageTab}
        tabs={[
          { value: "files", label: "Files" },
          { value: "chats", label: "Chats" },
        ]}
      >
        <span className="text-sm text-zinc-500">
          {storageTab === "files"
            ? `Total: ${formattedTotalSize} MB`
            : `Total: 3.98 MB`}
        </span>
      </ContentTabs>

      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {storageTab === "files" && (
            <TransitionPanel
              key="files"
              variant="fade"
              className="absolute inset-0"
            >
              <div className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5">File Name</TableHead>
                      <TableHead className="px-5">Type</TableHead>
                      <TableHead className="px-5 text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell
                          className="truncate max-w-37.5 sm:max-w-62.5 px-5"
                          title={file.name}
                        >
                          {file.name}
                        </TableCell>
                        <TableCell className="px-5">{file.type}</TableCell>
                        <TableCell className="text-right px-5">
                          {file.size.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TransitionPanel>
          )}
          {storageTab === "chats" && (
            <TransitionPanel
              key="chats"
              variant="fade"
              className="absolute inset-0"
            >
              <div className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5">ID</TableHead>
                      <TableHead className="px-5">Title</TableHead>
                      <TableHead className="text-right px-5">
                        Messages
                      </TableHead>
                      <TableHead className="text-right px-5">Age</TableHead>
                      <TableHead className="text-right px-5">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dummyChats.map((chat) => (
                      <TableRow key={chat.id}>
                        <TableCell className="px-5">{chat.id}</TableCell>
                        <TableCell
                          className="truncate max-w-37.5 sm:max-w-62.5 px-5"
                          title={chat.title}
                        >
                          {chat.title}
                        </TableCell>
                        <TableCell className="text-right px-5">
                          {chat.messages}
                        </TableCell>
                        <TableCell className="text-right px-5">
                          {chat.age}
                        </TableCell>
                        <TableCell className="text-right px-5">
                          {chat.size}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TransitionPanel>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StorageTab;
