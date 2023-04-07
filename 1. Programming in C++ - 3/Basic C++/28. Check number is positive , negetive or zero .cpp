#include <iostream>
using namespace std;
int main()
{
   int n;
   cout<<"****   Input a number for checking -it is positive , negetive or zero ....   *****"<<endl;
   cout<< "Input a number =";
   cin>>n;

   if(n>0)
   {
       cout<<"***  "<<n<<" number is positive ...  ***";
   } else if (n==0)
   {
         cout<<"***  "<<n<<" number is zero...  ***";
   }
   else
   {
         cout<<"***  "<<n<<" number is Negetive ...  ***";
   }
}
