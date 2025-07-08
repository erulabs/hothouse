"use client";

import { FaSync, FaTimes } from "react-icons/fa";
import { useState, useEffect, Fragment } from "react";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(true);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState<boolean>(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDownload = async () => {
    await fetch(`/api/download?jobId=${jobId}&candidateId=${candidateId}`, {
      method: "POST",
    });
  };

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
    const fetchJobs = async () => {
      try {
        setIsLoadingJobs(true);
        const response = await fetch(`/api/jobs`);
        const data = await response.json();
        setJobs(data.jobs);

        // Handle URL parameter on initial load
        const urlJobId = searchParams.get("jobId");
        if (urlJobId && data.jobs.length > 0) {
          const job = data.jobs.find((j: any) => j.id.toString() === urlJobId);
          if (job) {
            setSelectedJob(job);
            setJobId(job.id.toString());
          }
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchJobs();
  }, [searchParams]);

  const handleJobSelect = (item: any) => {
    setIsAnimating(true);

    // Update URL with jobId parameter
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("jobId", item.id.toString());
    router.push(newUrl.pathname + newUrl.search);

    // Small delay to allow animation to start
    setTimeout(() => {
      setSelectedJob(item);
      setJobId(item.id.toString());
      setIsAnimating(false);
    }, 300);
  };

  const SearchBar = () => (
    <div style={{ width: 400 }}>
      <ReactSearchAutocomplete
        items={jobs}
        onSelect={handleJobSelect}
        autoFocus={!selectedJob}
        placeholder="Search for a job"
        formatResult={(item: any) => (
          <span style={{ display: "block", textAlign: "left" }}>
            {item.name}
          </span>
        )}
      />
    </div>
  );

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <span className="ml-2">Loading jobs...</span>
    </div>
  );

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
          selectedJob ? "flex items-center justify-between p-2" : "p-2"
        }`}
      >
        <h1 className="font-bold text-xl">Hothouse</h1>
        {selectedJob && !isLoadingJobs && (
          <div
            className={`transition-all duration-300 ease-in-out ${
              isAnimating
                ? "opacity-50 transform scale-95"
                : "opacity-100 transform scale-100"
            }`}
          >
            <SearchBar />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {!selectedJob && (
          <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
            <div className="text-center">
              {isLoadingJobs ? (
                <LoadingSpinner />
              ) : (
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isAnimating
                      ? "opacity-50 transform scale-95"
                      : "opacity-100 transform scale-100"
                  }`}
                >
                  <div className="flex justify-center w-full m-12">
                    <SearchBar />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {jobs.map((job) => (
                      <a
                        key={job.id}
                        href={`/?jobId=${job.id}`}
                        className="text-xs block cursor-pointer"
                      >
                        {job.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedJob && (
          <div className="p-4">
            <div className="mt-4 max-w-screen-lg mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {candidates?.length || 0} {selectedJob.name} candidates
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
