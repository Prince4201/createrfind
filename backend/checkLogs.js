import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://avsruutkpniegqwzxfxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2c3J1dXRrcG5pZWdxd3p4Znh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc2OTA4NCwiZXhwIjoyMDkyMzQ1MDg0fQ.bWZLM-usYKN-XiKe3KXTGc7U0cGBu74a66QqZzL1YxY'; // Got from backend .env

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('status', 'failed')
        .order('sent_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching logs:', error);
    } else {
        console.log('Latest Failed Logs:');
        data.forEach(log => {
            console.log(`- ${log.sent_at} | ${log.to_email} | ERROR: ${log.error_message}`);
        });
    }
}

checkLogs();
