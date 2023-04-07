#include <iostream>
using namespace std;
int main()
{
   int n;

   cout<<"Enter A number = ";
   cin>>n;

   if(n%3==0 && n%5==0)
   {
       cout<<n<<" number is devisable by 3 and 5***";
   }
   else
   {
       cout<<n<<" number is not devisable by 3 and 5 ***";
   }
}
