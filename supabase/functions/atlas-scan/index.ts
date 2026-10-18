import {createClient} from 'npm:@supabase/supabase-js@2';
import {createScanHandler} from '../_shared/scan-service.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
Deno.serve(createScanHandler({env,authenticate:async(token:string)=>{const {data,error}=await db.auth.getUser(token);return error?null:data.user?.id;},reserve:async(owner:string,request:string)=>{const fn=env('SUPABASE_URL').includes('manikkusokwysmdfhxtu')?'atlas_test_reserve_scan':'atlas_reserve_scan';const {data,error}=await db.rpc(fn,{p_owner:owner,p_request:request});if(error)throw Error('quota');return data;}}));
