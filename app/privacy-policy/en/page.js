"use client";
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyEnPage() {
  const { darkMode } = useTheme();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 pt-safe-small ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className={`p-2 -ml-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Privacy Policy
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-xl shadow-sm p-6 space-y-6`}>
          
          <div className="text-sm text-gray-500 mb-4">
            Effective: February 11, 2026 |{' '}
            <Link href="/privacy-policy" className="text-purple-600 hover:underline">Magyar verzió</Link>
          </div>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              1. Introduction
            </h2>
            <p className="leading-relaxed">
              The operator of the Pharmagister application (&quot;Application&quot;, &quot;Service&quot;) is committed to protecting 
              the personal data of its users. This Privacy Policy describes what data we collect, how we use it, 
              and what rights you have regarding your data.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              2. Data Controller
            </h2>
            <p className="leading-relaxed">
              <strong>Developer:</strong> Epres László<br />
              <strong>Application name:</strong> Pharmagister<br />
              <strong>Email:</strong> epresla@icloud.com<br />
              <strong>Website:</strong> https://pharmagister.hu
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              3. Data Collected
            </h2>
            <p className="leading-relaxed mb-3">
              We collect and process the following personal data during the use of the Application:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Registration data:</strong> name, email address, password (encrypted)</li>
              <li><strong>Profile data:</strong> phone number, profile picture, bio, professional experience</li>
              <li><strong>Substitution requests:</strong> dates, location (zip code), position type</li>
              <li><strong>Communication data:</strong> messages, notifications</li>
              <li><strong>Technical data:</strong> device type, push notification token</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              4. Purpose of Data Processing
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Creating and managing user accounts</li>
              <li>Facilitating substitution requests and applications</li>
              <li>Enabling communication between users</li>
              <li>Sending push notifications (new requests, messages)</li>
              <li>Service improvement and bug fixes</li>
              <li><strong>Response rate measurement:</strong> we display pharmacies&apos; 72-hour response rates as a percentage on substitution requests to improve service quality. This data is automatically calculated based on responses to applications.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              5. Legal Basis for Data Processing
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Contract performance:</strong> data necessary for providing the service (GDPR Art. 6(1)(b))</li>
              <li><strong>Consent:</strong> push notifications, optional profile data (GDPR Art. 6(1)(a))</li>
              <li><strong>Legitimate interest:</strong> service security, abuse prevention (GDPR Art. 6(1)(f))</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              6. Data Sharing
            </h2>
            <p className="leading-relaxed mb-3">
              We share your personal data with third parties only in the following cases:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Other users:</strong> when applying, the pharmacy can see the data you have shared (configurable)</li>
              <li><strong>Service providers:</strong>
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li>Firebase (Google) – data storage, authentication, push notifications</li>
                  <li>Cloudinary – image and media file storage and processing</li>
                </ul>
              </li>
              <li><strong>Legal obligation:</strong> in case of official requests</li>
            </ul>
            <p className="leading-relaxed mt-3">
              <strong>We do not sell or share your personal data for advertising purposes.</strong>
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              7. Data Storage and Security
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Data is stored on Google Firebase EU servers</li>
              <li>Passwords are stored encrypted (hashed)</li>
              <li>We use HTTPS encrypted connections</li>
              <li>Only authorized personnel have access to the data</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              8. Data Retention
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>User account data: until account deletion</li>
              <li>Substitution requests: 1 year after expiration</li>
              <li>Messages: 2 years</li>
              <li>Upon account deletion, all data is deleted within 30 days</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              9. Your Rights
            </h2>
            <p className="leading-relaxed mb-3">
              Under GDPR, you have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Right of access:</strong> request a copy of your stored data</li>
              <li><strong>Right to rectification:</strong> request correction of your data</li>
              <li><strong>Right to erasure:</strong> request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Right to restriction:</strong> request restriction of data processing</li>
              <li><strong>Data portability:</strong> request transfer of your data to another service provider</li>
              <li><strong>Right to object:</strong> object to data processing</li>
            </ul>
            <p className="leading-relaxed mt-3">
              To exercise your rights, write to <strong>epresla@icloud.com</strong>. To delete your account instantly, log in and go to{' '}
              <Link href="/settings" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                Settings → Delete Account
              </Link>, or use the{' '}
              <Link href="/delete-account" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                deletion request form
              </Link>{' '}
              if you cannot log in.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              10. Push Notifications
            </h2>
            <p className="leading-relaxed">
              The Application may send push notifications about new substitution requests, messages, 
              and applications. You can disable notifications at any time in the Application settings 
              or in your device&apos;s system settings.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              11. Children&apos;s Data
            </h2>
            <p className="leading-relaxed">
              The Application is intended for users aged 18 and above. We do not knowingly collect 
              data from persons under the age of 18.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              12. Changes
            </h2>
            <p className="leading-relaxed">
              We reserve the right to modify this Privacy Policy. We will notify users of significant 
              changes within the Application or by email.
            </p>
          </section>

          <section>
            <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              13. Contact
            </h2>
            <p className="leading-relaxed">
              For data protection inquiries, please contact us:<br /><br />
              <strong>Developer:</strong> Epres László<br />
              <strong>Email:</strong> epresla@icloud.com<br />
              <strong>Website:</strong> https://pharmagister.hu
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
