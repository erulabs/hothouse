"use client";

import { FaSync, FaTimes } from "react-icons/fa";
import { useState, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(
    typeof window !== "undefined"
      ? window.location.search.split("jobId=").pop()
      : null,
  );
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState<boolean>(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  const handleDownload = async () => {
    await fetch(`/api/download?jobId=${jobId}&candidateId=${candidateId}`, {
      method: "POST",
    });
  };

  const JobSelectInput = () => (
    <Input
      value={jobId || ""}
      onChange={(e) => {
        let newJobId = e.target.value;
        if (e.target.value.startsWith("https://app.greenhouse.io/sdash/")) {
          newJobId = e.target.value.split("/").pop() || "";
        }
        window.location.href = `/?jobId=${newJobId}`;
      }}
      placeholder="Search for a job"
    />
  );

  const handleRate = async () => {
    if (!jobId && !candidateId) return;
    await fetch(
      `/api/rate` +
        new URLSearchParams({
          jobId: jobId || "",
          candidateId: candidateId || "",
          refresh: refresh ? "true" : "",
        }),
      {
        method: "POST",
      },
    );
  };

  const refreshCandidates = async () => {
    if (!jobId) return;
    const response = await fetch(`/api/candidates?jobId=${jobId}`);
    const data = await response.json();
    if (!data.candidates) {
      throw new Error("Invalid response from API: " + JSON.stringify(data));
    }
    setCandidates(data.candidates);
  };

  useEffect(() => {
    async function refresh() {
      setIsLoadingCandidates(true);
      await refreshCandidates();
      setIsLoadingCandidates(false);
    }
    refresh();
  }, [jobId]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className={`transition-all duration-300 ease-in-out ${
          jobId ? "flex items-center justify-between p-2" : "p-2"
        }`}
      >
        <h1 className="font-bold text-xl">Hothouse</h1>
        {jobId && (
          <div
            className={`transition-all duration-300 ease-in-out ${
              isAnimating
                ? "opacity-50 transform scale-95"
                : "opacity-100 transform scale-100"
            }`}
          >
            <JobSelectInput />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {!jobId && (
          <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
            <div className="text-center">
              <div
                className={`transition-all duration-300 ease-in-out ${
                  isAnimating
                    ? "opacity-50 transform scale-95"
                    : "opacity-100 transform scale-100"
                }`}
              >
                <div className="flex flex-col justify-center w-full m-12">
                  <JobSelectInput />
                  <div className="text-xs text-gray-500">
                    eg: 2952722 or https://app.greenhouse.io/sdash/2952722
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {jobId && (
          <div className="p-4">
            <div className="mt-4 max-w-screen-lg mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {candidates?.length || 0} candidates
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={refreshCandidates}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    <FaSync
                      className={`${isLoadingCandidates ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJob(null);
                      setJobId(null);
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        {isLoadingCandidates
                          ? "Loading..."
                          : "No candidates found"}
                      </TableCell>
                    </TableRow>
                  )}
                  {candidates.map((candidate) => (
                    <Fragment key={candidate.id}>
                      <TableRow
                        key={candidate.id}
                        className={
                          selectedCandidate === candidate ? "bg-gray-100" : ""
                        }
                      >
                        <TableCell>{candidate.name}</TableCell>
                        <TableCell>{candidate.score || "Unrated"}</TableCell>
                        <TableCell className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCandidate(
                                selectedCandidate === candidate
                                  ? null
                                  : candidate,
                              );
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                          >
                            Notes
                          </button>
                          <button
                            type="button"
                            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                          >
                            Remove
                          </button>
                        </TableCell>
                      </TableRow>
                      {selectedCandidate === candidate && (
                        <Fragment key={candidate.id}>
                          {["notes", "github", "linkedin", "personalSite"].map(
                            (key) => (
                              <TableRow
                                key={candidate.id + key}
                                className="bg-gray-100"
                              >
                                <TableCell>{key}</TableCell>
                                <TableCell></TableCell>
                                <TableCell
                                  colSpan={3}
                                  className="max-w-[500px] overflow-x-auto whitespace-pre-wrap"
                                >
                                  {candidate[key] &&
                                  candidate[key].startsWith("http") ? (
                                    <a href={candidate[key]} target="_blank">
                                      {candidate[key]}
                                    </a>
                                  ) : (
                                    candidate[key] || "-"
                                  )}
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                          <TableRow key={candidate.id + "spacer"}>
                            <TableCell colSpan={3} className="h-1"></TableCell>
                          </TableRow>
                        </Fragment>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
