import React from "react";

interface HeaderProps {
  isLoading: { moving: boolean; fetching: boolean };
  refresh: () => void;
  handleStudentCount: () => void;
  isRegisterCourse?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  isLoading,
  refresh,
  handleStudentCount,
  isRegisterCourse,
}) => {
  return (
    <div className="flex gap-6 items-center text-xl">
      <div className="flex gap-5 items-center">
        {!isLoading.fetching && (
          <>
            <a
              href="https://docs.google.com/spreadsheets/d/1CTlmTC4RgW4zk-A9VTkz4BGzjY2PMk5s/edit"
              className="font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all cursor-pointer !no-underline"
              target="_blank"
            >
              Xem review GV
            </a>
            <button
              type="button"
              onClick={refresh}
              className="font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all cursor-pointer"
            >
              Làm mới
            </button>
            {!isRegisterCourse && (
              <button
                type="button"
                onClick={handleStudentCount}
                className="font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all cursor-pointer"
                id="studentCount"
                title="(Có thể sẽ hơi lag)"
              >
                Lấy sĩ số
              </button>
            )}
            <span className="font-bold text-3xl" id="class-id">
              {document
                .getElementById("ctl00_mainContent_lblSubject")
                ?.textContent?.split("-")[0]
                .trim()}
            </span>
          </>
        )}

        {(isLoading.moving || isLoading.fetching) && (
          <>
            <div className="">
              {isLoading.moving
                ? "Đang thực hiện chuyển đổi, vui lòng đợi trong giây lát"
                : "Đang lấy sĩ số lớp"}
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-rotate-cw rotate"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </>
        )}
      </div>
    </div>
  );
};

export default Header;
