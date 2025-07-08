"use client"

import Image from "next/image";
import { useState, useEffect } from "react";
import { ReactSearchAutocomplete } from 'react-search-autocomplete'
import { useRouter, useSearchParams } from 'next/navigation'

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDownload = async () => {
    await fetch(`/api/download?jobId=${jobId}&candidateId=${candidateId}`)
  }

  const handleRate = async () => {
    await fetch(`/api/rate?jobId=${jobId}&candidateId=${candidateId}&refresh=${refresh}`)
  }

  const candidates = useState<any[]>([]);

  const handleCandidateSelect = async (candidateId: string) => {
    setCandidateId(candidateId)
  }

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoadingJobs(true);
        const response = await fetch(`/api/jobs`)
        const data = await response.json()
        setJobs(data.jobs)
        
        // Handle URL parameter on initial load
        const urlJobId = searchParams.get('jobId');
        if (urlJobId && data.jobs.length > 0) {
          const job = data.jobs.find((j: any) => j.id.toString() === urlJobId);
          if (job) {
            setSelectedJob(job);
            setJobId(job.id.toString());
          }
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
      } finally {
        setIsLoadingJobs(false);
      }
    }
    fetchJobs()
  }, [searchParams])

  const handleJobSelect = (item: any) => {
    setIsAnimating(true);
    
    // Update URL with jobId parameter
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('jobId', item.id.toString());
    router.push(newUrl.pathname + newUrl.search);
    
    // Small delay to allow animation to start
    setTimeout(() => {
      setSelectedJob(item);
      setJobId(item.id.toString());
      setIsAnimating(false);
    }, 300);
  }

  const SearchBar = () => (
    <div style={{ width: 400 }}>
      <ReactSearchAutocomplete
        items={jobs}
        onSelect={handleJobSelect}
        autoFocus={!selectedJob}
        placeholder="Search for a job"
        formatResult={(item: any) => <span style={{ display: 'block', textAlign: 'left' }}>{item.name}</span>}
      />
    </div>
  );

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <span className="ml-2">Loading jobs...</span>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className={`transition-all duration-300 ease-in-out ${
        selectedJob ? 'flex items-center justify-between p-2' : 'p-2'
      }`}>
        <h1 className="font-bold text-xl">Hothouse</h1>
        {selectedJob && !isLoadingJobs && (
          <div className={`transition-all duration-300 ease-in-out ${
            isAnimating ? 'opacity-50 transform scale-95' : 'opacity-100 transform scale-100'
          }`}>
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
                <div className={`transition-all duration-300 ease-in-out ${
                  isAnimating ? 'opacity-50 transform scale-95' : 'opacity-100 transform scale-100'
                }`}>
                  <SearchBar />
                </div>
              )}
            </div>
          </div>
        )}

        {selectedJob && (
          <div className="p-4">
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{selectedJob.name} candidates</h2>
                <button
                  onClick={handleDownload}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                >
                  Download Candidates
                </button>
              </div>
              {/* Add your existing job-related content here */}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
