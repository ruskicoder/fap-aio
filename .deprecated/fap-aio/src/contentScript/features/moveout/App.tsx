import React, { useEffect, useState } from "react";
import { parseHTML, query, queryAll, getText, getAttr } from "../../shared/dom-parser";
import { classData, slots, weekdays } from "./constants/classData";
import { formGetter, secondFormGetter } from "./constants/formData";
import { storage } from "../../shared/storage";
import {
  textToColor,
  mapToObject,
  objectToMap,
  getClassKey,
  send,
  getCurrentSubjects,
  getCurrentStatus,
  handleDownload,
  cleanTimetable,
} from "./utils";
import { sendTrackingEvent } from "./tracking";
import Header from "./components/Header";
import Timetable from "./components/Timetable";
import FilterSection from "./components/FilterSection";
import ClassListDetails from "./components/ClassListDetails";
import TimetableDetails from "./components/TimetableDetails";

export default function App() {
  const url = window.location.href;
  const id = url.slice(url.indexOf("id=") + 3).split("&")[0];
  const baseUrl = window.location.origin + window.location.pathname;
  const formData = formGetter(id);
  const [message, setMessage] = useState("");
  let secondId = "";
  let subject =
    document.getElementById("ctl00_mainContent_lblSubject")?.textContent || "";

  let cached = storage.getRaw(subject);
  let timeTableData = cached ? JSON.parse(cached) : null;

  const [timeTable, setTimeTable] = useState<
    Map<string, Map<string, string[]>>
  >(timeTableData ? objectToMap(timeTableData) : classData);
  const [total, setTotal] = useState(0);
  const [gotten, setGotten] = useState(0);
  const [isLoading, setIsLoading] = useState<any>({
    moving: false,
    fetching: false,
  });
  const [version, setVersion] = useState("1.3.9");
  const [moveList, setMoveList] = useState<any>([]);
  const [studentCount, setStudentCount] = useState<any>({});
  const [changeSubjectForm, setChangeSubjectForm] = useState<any>({});
  const [lecturerList, setLecturerList] = useState<any>([]);
  const [filter, setFilter] = useState<any>({
    lecturer: "",
    classId: "",
    studentCount: 100,
    excludeSlots: [],
    excludeWeekdays: [],
  });
  const [isFull, setIsFull] = useState(false);

  const handleStudentCount = async () => {
    await sendTrackingEvent();
    setIsLoading((prev: any) => ({
      ...prev,
      fetching: true,
    }));
    getCurrentStatus().then((res) => {
      console.log(res);
      setStudentCount(res);
      setIsLoading((prev: any) => ({
        ...prev,
        fetching: false,
      }));
      setFilter((prev: any) => ({
        ...prev,
        studentCount:
          Math.max(...Object.values(res).map((value) => Number(value))) ?? 100,
      }));
      alert("Đã lấy xong sĩ số!");
    });
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      await crawlAndSave();
      try {
        const response = await fetch(
          "https://ruskicoder.github.io/fap-moveout/noti.json",
          { cache: "no-cache" }
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        const message = `
          <div class="notification-container ${data.bg}">
            <span class="notification-dot animate-ping-slow mx-1"></span>
            <span class="notification-text font-semibold text-xl">
            ${data.message}
            </span>
            <span class="notification-dot animate-ping-slow mx-1"></span>
          </div>
        `;
        setMessage(message);
        setVersion(data.version);
      } catch (error) {
        console.log("Notification fetch failed, using defaults");
        setMessage("");
        setVersion("1.3.9");
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchClassListAndSubjects = async () => {
      fetch(`https://fap.fpt.edu.vn/Course/Groups.aspx?group=${id}`)
        .then((response) => response.text())
        .then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const element = doc.querySelector("#ctl00_mainContent_divStudents");
          if (element) {
            document.getElementById("class-list")?.appendChild(element);
          }
        });

      const data = await getCurrentSubjects();
      setMoveList(data.currentSubjects);
      setChangeSubjectForm({
        __VIEWSTATE: data.__VIEWSTATE,
        __VIEWSTATEGENERATOR: data.__VIEWSTATEGENERATOR,
        __EVENTVALIDATION: data.__EVENTVALIDATION,
        ctl00_mainContent_ddlCampuses: data.ctl00_mainContent_ddlCampuses,
      });
      handleToggleOldFeature();
    };

    fetchClassListAndSubjects();
  }, []);

  const refresh = async () => {
    await sendTrackingEvent();
    storage.removeRaw(subject);
    window.location.reload();
  };

  const crawlAndSave = async () => {
    if (
      Date.now() < Number(storage.getExpiry("expireAt")) &&
      timeTableData
    ) {
      let lecturerList: any = [];
      slots.forEach((slot: any) => {
        weekdays.forEach((day: any) => {
          timeTable
            .get(day)
            ?.get(slot)
            ?.forEach((item: any) => {
              let lecturer = item.split("(")[1].replace(")", "").split(" ")[0];
              if (!lecturerList.includes(lecturer)) {
                lecturerList.push(lecturer);
              }
            });
        });
      });
      setLecturerList(lecturerList);
      return;
    }

    const data: string =
      document.querySelector("#ctl00_mainContent_dllCourse")?.innerHTML || "";
    const doc = parseHTML(data);
    const classes = new Map<string, string>();
    classes.set(
      id,
      document.getElementById("ctl00_mainContent_lblOldGroup")?.innerText || ""
    );
    
    queryAll("option", doc).forEach((option: Element) => {
      const value = getAttr(option, "value");
      if (value) {
        secondId = value;
        classes.set(value, getText(option));
      }
    });

    setTotal(classes.size);

    const secondFormData = await secondFormGetter(secondId, id);
    for (const [key, _item] of classes) {
      formData.set("ctl00$mainContent$dllCourse", key);
      let nextClass;
      nextClass = await (
        await fetch(window.location.href, {
          method: "POST",
          headers: {},
          body: formData,
        })
      ).text();
      const nextDoc = parseHTML(nextClass);

      const classInfo = getText(query("#ctl00_mainContent_lblNewSlot", nextDoc));
      const selectOptions = queryAll("#ctl00_mainContent_dllCourse option", nextDoc);
      const selectedOption = selectOptions.find((opt: Element) => opt.hasAttribute("selected"));
      const className = selectedOption ? getText(selectedOption) : "";
      console.log("className", classInfo);

      const classDetail = classInfo.split(",");
      const lecture = classDetail[0].slice(
        classDetail[0].indexOf("Lecture:") + 9
      );
      const classRoom = classDetail[0].slice(
        classDetail[0].indexOf("RoomNo:") + 9,
        classDetail[0].indexOf(" - Lecture:")
      );

      for (const detail of classDetail) {
        const weekday = detail.slice(0, 3);
        const slot = detail.slice(11, 12);

        if (weekdays.indexOf(weekday) >= 0) {
          const updatedClassData = new Map(classData);
          const slotMap =
            updatedClassData.get(weekday) || new Map<string, string[]>();
          const classNames = slotMap.get(slot) || [];
          classNames.push(
            className +
              ` (${lecture.length > 0 ? lecture : "N/A"}) \n${classRoom}`
          );
          slotMap.set(slot, classNames);
          updatedClassData.set(weekday, slotMap);
          setTimeTable(updatedClassData);
        }
      }
      setGotten((prev) => prev + 1);
    }

    storage.setRaw(subject, JSON.stringify(mapToObject(timeTable)));
    let lecturerListTemp: any = [];
    slots.forEach((slot: any) => {
      weekdays.forEach((day: any) => {
        timeTable
          .get(day)
          ?.get(slot)
          ?.forEach((item: any) => {
            if (
              !lecturerListTemp.includes(
                item.slice(item.indexOf("(") + 1, item.indexOf(")"))
              )
            ) {
              let lecturer = item.slice(
                item.indexOf("(") + 1,
                item.indexOf(")")
              );
              console.log("lecturer temp", lecturer);
              lecturerListTemp.push(lecturer);
            }
          });
      });
    });
    console.log("lecturerListTemp", lecturerListTemp);
    setLecturerList(lecturerListTemp);
    storage.setExpiry("expireAt", 1000 * 60 * 60 * 24);
  };

  const handleToggleOldFeature = () => {
    document
      .getElementById("ctl00_mainContent_divMoveSubject")
      ?.classList.toggle("hidden");
    document
      .getElementById("ctl00_mainContent_divNewGroupInfo")
      ?.classList.toggle("hidden");
  };

  const MoveToFilledClass = () => (
    <div className="text-xl font-semibold flex gap-6 items-center mt-4">
      <a
        href="https://github.com/ruskicoder/fap-moveout"
        target="_blank"
        className="text-blue-500 !no-underline transition-all duration-200 border-blue-500 border-b-2 hover:border-transparent"
      >
        v1.3.9
      </a>
      <a
        href="https://github.com/ruskicoder/fap-moveout/issues"
        target="_blank"
        className="text-blue-500 !no-underline transition-all duration-200 border-blue-500 border-b-2 hover:border-transparent"
      >
        Feedback 😇
      </a>
    </div>
  );

  const ShowOldFeature = () => (
    <div className="flex items-center gap-2 mt-4">
      <input
        id="showOldFeature"
        type="checkbox"
        defaultChecked={false}
        onChange={handleToggleOldFeature}
      />
      <label
        className="text-xl mb-0 mt-2 leading-none"
        htmlFor="showOldFeature"
      >
        Hiện chức năng FAP cũ
      </label>
    </div>
  );

  return (
    <div className="w-full">
      <div className="mt-3">
        <Header
          isLoading={isLoading}
          refresh={refresh}
          handleStudentCount={handleStudentCount}
        />
        <FilterSection
          filter={filter}
          setFilter={setFilter}
          studentCount={studentCount}
          lecturerList={lecturerList}
          moveList={moveList}
          subject={subject}
          changeSubjectForm={changeSubjectForm}
          setIsLoading={setIsLoading}
          isRegisterCourse={false}
          send={send}
        />
        {gotten < total && (
          <span className="my-4 flex gap-4 justify-between items-center w-full">
            <span className="text-2xl">
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
            </span>
            <progress
              value={gotten}
              max={total}
              className="w-full border border-zinc-500"
            />
          </span>
        )}
      </div>
      <div
        className="text-2xl mb-4"
        dangerouslySetInnerHTML={{ __html: message }}
      />
      <Timetable
        timeTable={timeTable}
        filter={filter}
        studentCount={studentCount}
        getClassKey={getClassKey}
        sendTrackingEvent={sendTrackingEvent}
        setIsLoading={setIsLoading}
        formData={formData}
        setIsFull={setIsFull}
        subject={subject}
        setFilter={setFilter}
      />

      <ClassListDetails handleDownload={handleDownload} />
      <TimetableDetails />
      <MoveToFilledClass />
      <ShowOldFeature />
    </div>
  );
}
