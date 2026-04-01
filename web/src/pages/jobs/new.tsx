import { createJob } from "@/lib/jobs";
import { useRouter } from "next/router";
import { useState } from "react";

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const jobId = await createJob({ title, company, description });
      router.push(`/jobs/${jobId}`);
    } catch (error) {
      console.error(error);
      alert("Error creating job");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create a New Job</h1>
      <input
        type="text"
        placeholder="Job Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        required
      />
      <textarea
        placeholder="Job Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <button type="submit">Create Job</button>
    </form>
  );
}
