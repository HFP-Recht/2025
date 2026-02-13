import { Link } from "react-router-dom";
import { useCourse } from "./CourseLayout";

export function CourseHomePage(): JSX.Element {
  const { course } = useCourse();

  return (
    <div className="course-home">
      <h1>{course.title}</h1>
      <p className="course-description">{course.description}</p>

      <div className="subtopic-cards">
        {course.subtopics.map((subtopic) => (
          <Link
            key={subtopic.moduleId}
            to={`/course/${course.courseId}/${subtopic.moduleId}/grundlagen`}
            className="subtopic-card"
          >
            <span className="subtopic-order">{String(subtopic.order / 10).padStart(2, "0")}</span>
            <h3>{subtopic.title}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
