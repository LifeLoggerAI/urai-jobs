import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Access Required</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            You must be an administrator to access this page.
          </p>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Please contact your system administrator for access.
          </p>
        </div>

        <div className="mt-6 text-center">
            <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
              Go back to the homepage
            </Link>
        </div>
      </div>
    </div>
  );
}
