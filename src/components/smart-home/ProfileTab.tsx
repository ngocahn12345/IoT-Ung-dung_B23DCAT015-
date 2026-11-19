import { useState, useRef } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  Edit2,
  ExternalLink,
  Figma,
  FileCode2,
  FileText,
  Github,
  GraduationCap,
  HardDrive,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import { initialProfile, UserProfileData } from "./mockData";

export function ProfileTab() {
  const [profile, setProfile] = useState<UserProfileData>(initialProfile);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<UserProfileData>(initialProfile);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"personal" | "education" | "links">("personal");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setProfile((prev) => ({ ...prev, avatarUrl: result }));
        setEditForm((prev) => ({ ...prev, avatarUrl: result }));
        showToast("Đã đổi ảnh đại diện thành công!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setProfile((prev) => ({ ...prev, pdfReport: result, pdfReportName: file.name }));
        setEditForm((prev) => ({ ...prev, pdfReport: result, pdfReportName: file.name }));
        showToast(`Đã tải lên tệp PDF "${file.name}" thành công!`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenEdit = () => {
    setEditForm(profile);
    setActiveModalTab("personal");
    setIsEditModalOpen(true);
  };

  const handleOpenSectionEdit = (tab: "personal" | "education" | "links") => {
    setEditForm(profile);
    setActiveModalTab(tab);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(editForm);
    setIsEditModalOpen(false);
    showToast("Cập nhật thông tin hồ sơ cá nhân thành công!");
  };



  return (
    <div className="space-y-4">
      {/* Hidden PDF Input */}
      <input
        type="file"
        ref={pdfInputRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handlePdfFileChange}
      />

      {/* Header Profile - Compact Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-5 py-3.5 shadow-xs">
        <div className="flex items-center gap-3.5">
          {/* Avatar Container với nút Đổi ảnh */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            title="Nhấp để đổi ảnh đại diện"
            className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-xs grid place-items-center"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
                {profile.displayName
                  .trim()
                  .split(" ")
                  .map((w) => w[0])
                  .slice(-2)
                  .join("")
                  .toUpperCase() || "NA"}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white">
              <Camera className="h-5 w-5" />
            </div>
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card z-10" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold text-foreground">
                {profile.displayName}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                <Sparkles className="h-3 w-3" />
                {profile.classYear}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {profile.school} • {profile.location}
            </p>
          </div>
        </div>


      </div>

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {toastMessage}
        </div>
      )}

      {/* Vertical List Cards */}
      <div className="flex flex-col gap-3.5">
        {/* Card 1: Cá nhân */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2 text-xs font-bold text-foreground">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>Thông Tin Cá Nhân</span>
            </div>
            <button
              onClick={() => handleOpenSectionEdit("personal")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
            >
              <Edit2 className="h-3 w-3" />
              <span>Chỉnh sửa</span>
            </button>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Mã sinh viên:</span>
              <span className="font-mono font-semibold text-primary">{profile.studentId}</span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Ngày sinh:</span>
              <span className="font-medium text-foreground">{profile.dateOfBirth}</span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Giới tính:</span>
              <span className="font-medium text-foreground">{profile.gender}</span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-mono text-foreground truncate max-w-[200px]">
                {profile.email}
              </span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">SĐT:</span>
              <span className="font-mono text-foreground">{profile.phone}</span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Địa chỉ:</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {profile.location}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Học Tập */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2 text-xs font-bold text-foreground">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
              <span>Thông Tin Học Tập</span>
            </div>
            <button
              onClick={() => handleOpenSectionEdit("education")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:underline cursor-pointer"
            >
              <Edit2 className="h-3 w-3" />
              <span>Chỉnh sửa</span>
            </button>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Trường:</span>
              <span className="font-semibold text-foreground truncate">{profile.school}</span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Ngành:</span>
              <span className="font-semibold text-primary">{profile.major}</span>
            </div>
            <div className="flex justify-between sm:justify-start sm:gap-2">
              <span className="text-muted-foreground">Niên khóa:</span>
              <span className="font-medium text-foreground">
                {profile.startYear} - {profile.expectedGradYear}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Liên Kết */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2 text-xs font-bold text-foreground">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-sky-500" />
              <span>Liên Kết & Dự Án</span>
            </div>
            <button
              onClick={() => handleOpenSectionEdit("links")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-500 hover:underline cursor-pointer"
            >
              <Edit2 className="h-3 w-3" />
              <span>Chỉnh sửa</span>
            </button>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 transition-colors hover:bg-secondary hover:text-primary"
            >
              <div className="flex items-center gap-2">
                <Github className="h-3.5 w-3.5 text-foreground" />
                <span className="font-medium">Kho lưu trữ GitHub</span>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>

            <a
              href={profile.figma}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 transition-colors hover:bg-secondary hover:text-purple-600"
            >
              <div className="flex items-center gap-2">
                <Figma className="h-3.5 w-3.5 text-purple-500" />
                <span className="font-medium">Bản thiết kế Figma</span>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>

            <a
              href={profile.apiDocs}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 transition-colors hover:bg-secondary hover:text-amber-600"
            >
              <div className="flex items-center gap-2">
                <FileCode2 className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium">Tài liệu API (Postman)</span>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>

            <a
              href={profile.googleDrive || "https://drive.google.com/drive/folders/1cO8buMF3plyfa8ac4xX1Jwebg79oR1of?usp=sharing"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 transition-colors hover:bg-secondary hover:text-blue-500"
            >
              <div className="flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-medium">Thư mục Google Drive</span>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>

      {/* Modal Chỉnh Sửa Toàn Bộ Hồ Sơ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Chỉnh Sửa Toàn Bộ Hồ Sơ Cá Nhân
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cập nhật tất cả các trường thông tin hiển thị trên hồ sơ
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Section Tabs */}
            <div className="flex border-b border-border/60 px-6 overflow-x-auto gap-2 py-2">
              {[
                { id: "personal", label: "Cá nhân & Liên hệ" },
                { id: "education", label: "Học tập" },
                { id: "links", label: "Liên kết & Mạng XH" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModalTab(tab.id as typeof activeModalTab)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                    activeModalTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 text-xs">
                {/* Tab 1: Cá nhân & Liên hệ */}
                {activeModalTab === "personal" && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Họ và tên:</label>
                      <input
                        type="text"
                        value={editForm.displayName}
                        onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        Ảnh đại diện (URL hoặc tải từ máy):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Dán đường dẫn URL ảnh hoặc chọn từ máy..."
                          value={editForm.avatarUrl || ""}
                          onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80"
                        >
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          Chọn ảnh
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">
                          Mã sinh viên:
                        </label>
                        <input
                          type="text"
                          value={editForm.studentId}
                          onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">
                          Ngày sinh:
                        </label>
                        <input
                          type="text"
                          value={editForm.dateOfBirth}
                          onChange={(e) =>
                            setEditForm({ ...editForm, dateOfBirth: e.target.value })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">
                          Giới tính:
                        </label>
                        <input
                          type="text"
                          value={editForm.gender}
                          onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">SĐT:</label>
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Email:</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Địa chỉ:</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Tab 2: Học tập */}
                {activeModalTab === "education" && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        Trường học:
                      </label>
                      <input
                        type="text"
                        value={editForm.school}
                        onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        Chuyên ngành:
                      </label>
                      <input
                        type="text"
                        value={editForm.major}
                        onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">
                          Khóa học:
                        </label>
                        <input
                          type="text"
                          value={editForm.classYear}
                          onChange={(e) => setEditForm({ ...editForm, classYear: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">
                          Năm bắt đầu:
                        </label>
                        <input
                          type="text"
                          value={editForm.startYear}
                          onChange={(e) => setEditForm({ ...editForm, startYear: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-foreground">
                          Dự kiến tốt nghiệp:
                        </label>
                        <input
                          type="text"
                          value={editForm.expectedGradYear}
                          onChange={(e) =>
                            setEditForm({ ...editForm, expectedGradYear: e.target.value })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Liên kết & Mạng XH */}
                {activeModalTab === "links" && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        GitHub URL:
                      </label>
                      <input
                        type="url"
                        value={editForm.github}
                        onChange={(e) => setEditForm({ ...editForm, github: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Figma URL:</label>
                      <input
                        type="url"
                        value={editForm.figma}
                        onChange={(e) => setEditForm({ ...editForm, figma: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        Tài liệu API (Postman) Docs URL:
                      </label>
                      <input
                        type="url"
                        placeholder="https://documenter.getpostman.com/view/..."
                        value={editForm.apiDocs}
                        onChange={(e) => setEditForm({ ...editForm, apiDocs: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        Thư mục Google Drive URL:
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={editForm.googleDrive || ""}
                        onChange={(e) => setEditForm({ ...editForm, googleDrive: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">
                        Tệp Báo Cáo PDF:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Dán URL PDF hoặc chọn file từ máy..."
                          value={editForm.pdfReport || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, pdfReport: e.target.value })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          Up PDF
                        </button>
                      </div>
                      {editForm.pdfReportName && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Tệp hiện tại: <span className="font-semibold text-rose-500">{editForm.pdfReportName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-border/80 px-6 py-4">
                <span className="text-xs text-muted-foreground">
                  * Nhấn Lưu để cập nhật tức thì toàn bộ thông tin
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Lưu Toàn Bộ Thay Đổi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
