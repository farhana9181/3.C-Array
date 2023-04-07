#include <iostream>
using namespace std;
int main()
{  int n;
   cout<<"***   Enter a Number  of (1-7) Week for finding Day name.... ***"  <<endl ;
   cout<<"Input Day Number = ";
   cin>>n;

   if(n==1)
   {
       cout<<"** Day "<<n<<" is  Saturday...   **"   ;
   }else if(n==2)
   {
       cout<<"** Day "<<n<<" is  Sunday...   **"   ;
   }else if(n==3)
   {
       cout<<"** Day "<<n<<" is  Monday...   **"   ;
   }else if(n==4)
   {
       cout<<"** Day "<<n<<" is  Tuesday...   **"   ;
   }else if(n==5)
   {
       cout<<"** Day "<<n<<" is  Wednesday...   **"   ;
   }else if(n==6)
   {
       cout<<"** Day "<<n<<" is  Thursday...   **"   ;
   }else if(n==7)
   {
       cout<<"** Day "<<n<<" is  Friday...   **"   ;
   }else
   {
        cout<<"** Day "<<n<<" is  Not finding and Not correct  ...   **"   ;
   }
}
